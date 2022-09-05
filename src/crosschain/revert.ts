import { Filter, TransactionRequest } from '@ethersproject/providers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ContractTransaction, Signer } from 'ethers'
import { TokenAmount } from '../entities'
import { Error, ErrorCode } from './error'
import { PendingRequest } from './pending'
import type { Symbiosis } from './symbiosis'
import { calculateGasMargin, getExternalId, getLogWithTimeout } from './utils'
import { ChainId } from '../constants'
import { MANAGER_CHAIN } from './constants'
import { NerveTrade } from './nerveTrade'
import { MulticallRouter } from './contracts'

export class RevertPending {
    protected multicallRouter: MulticallRouter

    private deadline!: number
    private slippage!: number

    constructor(private symbiosis: Symbiosis, private request: PendingRequest) {
        this.multicallRouter = this.symbiosis.multicallRouter(MANAGER_CHAIN)
    }

    async revert(slippage: number, deadline: number) {
        this.slippage = slippage
        this.deadline = deadline

        console.log({ slippage, deadline })

        const fee = await this.getFee()
        console.log({ fee: fee.toSignificant() })

        const transactionRequest = await this.getTransactionRequest(fee)

        return {
            fee,
            transactionRequest,
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
        }
    }

    // Wait for the revert transaction to be mined on the original chain
    async waitForComplete() {
        const { chainIdFrom, type } = this.request

        const externalId = this.getExternalId()

        let filter: Filter
        if (type === 'synthesize') {
            const otherPortal = this.symbiosis.portal(chainIdFrom)
            filter = otherPortal.filters.RevertSynthesizeCompleted(externalId)
        } else {
            const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)
            filter = otherSynthesis.filters.RevertBurnCompleted(externalId)
        }

        const log = await getLogWithTimeout({ chainId: chainIdFrom, filter, symbiosis: this.symbiosis })

        return log.transactionHash
    }

    private buildMetaBurnCalldata() {
        const chainId = ChainId.MATIC_MUMBAI // FIXME
        const { to } = this.request
        const synthesis = this.symbiosis.synthesis(MANAGER_CHAIN)
        const sToken = '0xBB44A9662f58467351cBE88A18c44B0508AF4182' // FIXME  address sToken;
        const metarouter = this.symbiosis.metaRouter(MANAGER_CHAIN)

        const calldata = synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
            {
                stableBridgingFee: '0', // uint256 stableBridgingFee;
                amount: '0', // uint256 amount;
                syntCaller: metarouter.address, // address syntCaller;
                finalReceiveSide: AddressZero, // address finalReceiveSide;
                sToken,
                finalCallData: [], // bytes finalCallData;
                finalOffset: 0, // uint256 finalOffset;
                chain2address: to, // address chain2address;
                receiveSide: this.symbiosis.portal(chainId).address,
                oppositeBridge: this.symbiosis.bridge(chainId).address,
                revertableAddress: to,
                chainID: chainId,
                clientID: this.symbiosis.clientId,
            },
        ])
        return [sToken, calldata]
    }

    private async getFee(): Promise<TokenAmount> {
        const { type, chainIdTo, chainIdFrom } = this.request

        const externalId = this.getExternalId()

        let receiveSide: string
        let calldata: string

        if (type === 'synthesize') {
            const portal = this.symbiosis.portal(chainIdFrom)
            calldata = portal.interface.encodeFunctionData('revertSynthesize', ['0', externalId])
            receiveSide = portal.address
        } else {
            // const synthesis = this.symbiosis.synthesis(chainIdFrom)
            // calldata = synthesis.interface.encodeFunctionData('revertBurn', ['0', externalId])
            // receiveSide = synthesis.address

            const synthesis = this.symbiosis.synthesis(MANAGER_CHAIN)
            const [router, swapCalldata] = await this.buildSwapCalldata()
            const [burnToken, burnCalldata] = this.buildMetaBurnCalldata()

            calldata = synthesis.interface.encodeFunctionData('revertMetaBurn', [
                '0', // stableBridgingFee
                externalId,
                router,
                swapCalldata,
                synthesis.address,
                burnToken,
                burnCalldata,
            ])
            receiveSide = synthesis.address
        }

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: chainIdTo,
            chainIdTo: chainIdFrom,
        })

        const feeTokenAmount = new TokenAmount(this.request.fromTokenAmount.token, fee)
        if (this.request.fromTokenAmount.lessThan(feeTokenAmount)) {
            throw new Error(
                `Amount $${this.request.fromTokenAmount.toSignificant()} less than fee $${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        return feeTokenAmount
    }

    private async getTransactionRequest(fee: TokenAmount): Promise<TransactionRequest> {
        if (this.request.type === 'synthesize') {
            return this.getRevertSynthesizeTransactionRequest(fee)
        }

        return await this.getMetaRevertBurnTransactionRequest(fee)
    }

    private getRevertSynthesizeTransactionRequest(fee: TokenAmount): TransactionRequest {
        const { internalId, chainIdTo, chainIdFrom } = this.request

        const synthesis = this.symbiosis.synthesis(chainIdTo)
        const otherPortal = this.symbiosis.portal(chainIdFrom)
        const otherBridge = this.symbiosis.bridge(chainIdFrom)

        return {
            to: synthesis.address,
            data: synthesis.interface.encodeFunctionData('revertSynthesizeRequest', [
                fee.raw.toString(),
                internalId,
                otherPortal.address,
                otherBridge.address,
                chainIdFrom,
                this.symbiosis.clientId,
            ]),
            chainId: chainIdTo,
        }
    }

    // private getRevertBurnTransactionRequest(fee: TokenAmount): TransactionRequest {
    //     const { internalId, chainIdTo, chainIdFrom } = this.request
    //
    //     const otherBridge = this.symbiosis.bridge(chainIdFrom)
    //     const portal = this.symbiosis.portal(chainIdTo)
    //     const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)
    //
    //     return {
    //         to: portal.address,
    //         data: portal.interface.encodeFunctionData('revertBurnRequest', [
    //             fee.raw.toString(),
    //             internalId,
    //             otherSynthesis.address,
    //             otherBridge.address,
    //             chainIdFrom,
    //             this.symbiosis.clientId,
    //         ]),
    //         chainId: chainIdTo,
    //     }
    // }

    private async buildSwapCalldata(fee?: TokenAmount): Promise<[string, string]> {
        const { fromTokenAmount } = this.request
        const managerStable = this.symbiosis.transitStable(MANAGER_CHAIN)

        const amount = fee ? fromTokenAmount.subtract(fee) : fromTokenAmount
        const nervePool1 = this.symbiosis.nervePool(fromTokenAmount.token, managerStable)
        const nerveTrade1 = new NerveTrade(
            amount,
            managerStable,
            this.slippage,
            this.deadline,
            nervePool1,
            this.symbiosis
        )
        await nerveTrade1.init()

        console.log('nerveTrade1', {
            tokenAmountIn: nerveTrade1.tokenAmountIn.toSignificant(),
            amountOut: nerveTrade1.amountOut.toSignificant(),
        })

        const tokenOut = this.symbiosis.findStable('0xBB44A9662f58467351cBE88A18c44B0508AF4182', 97) // FIXME
        if (!tokenOut) throw new Error('Stable not found')
        const nervePool2 = this.symbiosis.nervePool(managerStable, tokenOut)
        const nerveTrade2 = new NerveTrade(
            nerveTrade1.amountOut,
            tokenOut,
            this.slippage,
            this.deadline,
            nervePool2,
            this.symbiosis
        )
        await nerveTrade2.init()

        console.log('nerveTrade2', {
            tokenAmountIn: nerveTrade2.tokenAmountIn.toSignificant(),
            amountOut: nerveTrade2.amountOut.toSignificant(),
        })
        const trades = [nerveTrade1, nerveTrade2]

        return [
            this.multicallRouter.address,
            this.multicallRouter.interface.encodeFunctionData('multicall', [
                trades[0].tokenAmountIn.raw.toString(),
                trades.map((i) => i.callData), // calldata
                trades.map((i) => i.pool.address), // receiveSides
                [
                    ...trades.map((i) => i.tokenAmountIn.token.address), // path
                    trades[trades.length - 1].amountOut.token.address,
                ],
                trades.map(() => 100), // offset
                this.symbiosis.metaRouter(MANAGER_CHAIN).address,
            ]),
        ]
    }

    private async getMetaRevertBurnTransactionRequest(fee: TokenAmount): Promise<TransactionRequest> {
        const { internalId, chainIdTo, chainIdFrom: managerChainId } = this.request

        const managerChainBridge = this.symbiosis.bridge(managerChainId)
        const portal = this.symbiosis.portal(chainIdTo)
        const managerChainSynthesis = this.symbiosis.synthesis(managerChainId)

        const [router, swapCalldata] = await this.buildSwapCalldata(fee)
        const [burnToken, burnCalldata] = this.buildMetaBurnCalldata()

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    internalID: internalId,
                    receiveSide: managerChainSynthesis.address,
                    managerChainBridge: managerChainBridge.address,
                    managerChainId,
                    sourceChainBridge: AddressZero,
                    sourceChainId: ChainId.MATIC_MUMBAI, // FIXME get from somewhere
                    sourceChainSynthesis: managerChainSynthesis.address,
                    router, // multicall router
                    swapCalldata,
                    burnToken,
                    burnCalldata,
                    clientID: this.symbiosis.clientId,
                },
            ]),
            chainId: chainIdTo,
        }
    }

    private async execute(transactionRequest: TransactionRequest, signer: Signer) {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequest)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const transaction = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, transaction),
            transaction,
        }
    }

    private async waitForMined(confirmations: number, response: ContractTransaction) {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(),
        }
    }

    private getExternalId(): string {
        const { type, internalId, chainIdTo: chainId, revertableAddress } = this.request

        let contractAddress: string
        if (type === 'synthesize') {
            contractAddress = this.symbiosis.synthesis(chainId).address
        } else {
            contractAddress = this.symbiosis.portal(chainId).address
        }

        return getExternalId({ internalId, chainId, revertableAddress, contractAddress })
    }
}

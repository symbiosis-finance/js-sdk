import { Filter, TransactionRequest } from '@ethersproject/providers'
import { MaxUint256 } from '@ethersproject/constants'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ContractTransaction, Signer } from 'ethers'
import JSBI from 'jsbi'
import { Token, TokenAmount } from '../entities'
import { Error, ErrorCode } from './error'
import type { Symbiosis } from './symbiosis'
import { getExternalId, getInternalId, getLogWithTimeout, prepareTransactionRequest } from './utils'
import { MulticallRouter } from './contracts'
import { ChainId } from '../constants'
import { WaitForComplete } from './waitForComplete'
import { OmniTrade } from './trade'
import { OmniPoolConfig } from './types'
import { PendingRequest } from './revertRequest'

export class RevertPending {
    protected multicallRouter: MulticallRouter

    private deadline!: number
    private slippage!: number
    private transitTokenFrom!: Token
    private transitTokenTo!: Token
    private omniPoolConfig: OmniPoolConfig

    constructor(private symbiosis: Symbiosis, private request: PendingRequest) {
        const omniPoolConfig = symbiosis.getOmniPoolByToken(this.request.fromTokenAmount.token)
        if (!omniPoolConfig) {
            throw new Error('No omni pool found for token', ErrorCode.NO_TRANSIT_POOL)
        }

        this.omniPoolConfig = omniPoolConfig
        this.multicallRouter = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId)
    }

    async revert(slippage: number, deadline: number) {
        this.slippage = slippage
        this.deadline = deadline

        this.transitTokenFrom = await this.symbiosis.transitToken(this.request.chainIdFrom, this.omniPoolConfig)
        this.transitTokenTo = await this.symbiosis.transitToken(this.request.chainIdTo, this.omniPoolConfig)

        const fee = await this.getFee()

        const feeV2 = this.request.type === 'burn-v2' ? await this.getFeeV2() : undefined

        const transactionRequest = await this.getTransactionRequest(fee, feeV2)

        return {
            fee,
            transactionRequest,
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
        }
    }

    private async waitForCompleteV2() {
        const { chainIdFrom, internalId, chainIdTo, revertableAddress } = this.request

        const externalId = getExternalId({
            internalId,
            chainId: chainIdTo,
            revertableAddress,
            contractAddress: this.symbiosis.portal(chainIdTo).address,
        })
        const mChainSynthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)

        const revertBurnLog = await getLogWithTimeout({
            chainId: this.omniPoolConfig.chainId,
            filter: mChainSynthesis.filters.RevertBurnCompleted(externalId),
            symbiosis: this.symbiosis,
        })

        const receipt = await mChainSynthesis.provider.getTransactionReceipt(revertBurnLog.transactionHash)

        const wfc = new WaitForComplete({
            direction: 'burn',
            symbiosis: this.symbiosis,
            revertableAddress: revertableAddress,
            chainIdIn: this.omniPoolConfig.chainId,
            chainIdOut: chainIdFrom,
        })
        const log = await wfc.waitForComplete(receipt)

        return log.transactionHash
    }

    private async waitForCompleteV2Revert() {
        const { chainIdFrom, chainIdTo, revertableAddress } = this.request
        const synthesis = this.symbiosis.synthesis(chainIdFrom)
        const externalId = this.getExternalId()
        const filter = synthesis.filters.RevertBurnCompleted(externalId)
        const revertBurnLog = await getLogWithTimeout({ chainId: chainIdFrom, filter, symbiosis: this.symbiosis })

        const receipt = await synthesis.provider.getTransactionReceipt(revertBurnLog.transactionHash)

        const wfc = new WaitForComplete({
            direction: 'burn',
            symbiosis: this.symbiosis,
            revertableAddress: revertableAddress,
            chainIdIn: chainIdFrom,
            chainIdOut: chainIdTo,
        })
        const log = await wfc.waitForComplete(receipt)

        return log.transactionHash
    }

    // Wait for the revert transaction to be mined on the original chain
    async waitForComplete() {
        const { type } = this.request
        if (type === 'burn-v2') {
            return this.waitForCompleteV2()
        }

        if (type === 'burn-v2-revert') {
            return this.waitForCompleteV2Revert()
        }

        const { chainIdFrom } = this.request
        const externalId = this.getExternalId()

        let filter: Filter
        if (type === 'synthesize' || type === 'synthesize-v2') {
            const otherPortal = this.symbiosis.portal(chainIdFrom)
            filter = otherPortal.filters.RevertSynthesizeCompleted(externalId)
        } else {
            const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)
            filter = otherSynthesis.filters.RevertBurnCompleted(externalId)
        }

        const log = await getLogWithTimeout({ chainId: chainIdFrom, filter, symbiosis: this.symbiosis })

        return log.transactionHash
    }

    protected async getFeeV2(): Promise<TokenAmount> {
        const feeToken = this.transitTokenFrom
        const [receiveSide, calldata] = await this.feeBurnCallDataV2()

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.omniPoolConfig.chainId,
            chainIdTo: this.request.chainIdFrom,
        })
        return new TokenAmount(feeToken, fee.toString())
    }

    protected async feeBurnCallDataV2(): Promise<[string, string]> {
        const chainIdIn = this.omniPoolConfig.chainId
        const chainIdOut = this.request.chainIdFrom
        const { revertableAddress, fromTokenAmount } = this.request

        const synthesis = this.symbiosis.synthesis(chainIdIn)
        const portal = this.symbiosis.portal(chainIdOut)

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portal.address,
            revertableAddress: revertableAddress,
            chainId: chainIdOut,
        })

        const calldata = portal.interface.encodeFunctionData('metaUnsynthesize', [
            '0', // _stableBridgingFee
            externalId, // _externalID,
            revertableAddress, // _to
            fromTokenAmount.raw.toString(), // _amount
            this.transitTokenFrom.address, // _rToken
            AddressZero, // _finalReceiveSide
            [], // _finalCalldata
            0, // _finalOffset
        ])
        return [portal.address, calldata]
    }

    private buildMetaBurnCalldata(feeV2?: TokenAmount) {
        const { to, from, chainIdFrom } = this.request
        const synthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)
        const synth = this.getSyntheticToken(this.transitTokenFrom)
        if (!synth) {
            throw new Error(`Cannot find synthetic token between mChain and ${chainIdFrom}`)
        }

        const metarouter = this.symbiosis.metaRouter(this.omniPoolConfig.chainId)

        const calldata = synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
            {
                stableBridgingFee: feeV2 ? feeV2.raw.toString() : '0',
                amount: '0',
                syntCaller: metarouter.address,
                finalReceiveSide: AddressZero,
                sToken: synth.address,
                finalCallData: [],
                finalOffset: 0,
                chain2address: from, // NOTE: funds will be returned there if got stuck
                receiveSide: this.symbiosis.portal(chainIdFrom).address,
                oppositeBridge: this.symbiosis.bridge(chainIdFrom).address,
                revertableAddress: to,
                chainID: chainIdFrom,
                clientID: this.symbiosis.clientId,
            },
        ])
        return [synth.address, calldata]
    }

    private async getFee(): Promise<TokenAmount> {
        const { type, chainIdTo, chainIdFrom, internalId, revertableAddress } = this.request

        const externalId = this.getExternalId()

        let receiveSide: string
        let calldata: string
        let advisorChainIdFrom: ChainId = chainIdTo
        let advisorChainIdTo: ChainId = chainIdFrom
        const feeToken = this.request.originalFromTokenAmount.token

        if (type === 'synthesize') {
            const portal = this.symbiosis.portal(chainIdFrom)
            calldata = portal.interface.encodeFunctionData('revertSynthesize', ['0', externalId])
            receiveSide = portal.address
        } else if (type === 'burn') {
            const synthesis = this.symbiosis.synthesis(chainIdFrom)
            calldata = synthesis.interface.encodeFunctionData('revertBurn', ['0', externalId])
            receiveSide = synthesis.address
        } else if (type === 'synthesize-v2') {
            advisorChainIdFrom = chainIdFrom
            advisorChainIdTo = chainIdTo

            const synthesis = this.symbiosis.synthesis(chainIdTo)
            calldata = synthesis.interface.encodeFunctionData('revertSynthesizeRequestByBridge', [
                '0',
                internalId,
                this.symbiosis.portal(chainIdFrom).address, // _receiveSide
                this.symbiosis.bridge(chainIdFrom).address, // _oppositeBridge
                chainIdFrom, // _chainId
                revertableAddress, // _sender
                this.symbiosis.clientId, // _clientId
            ])
            receiveSide = synthesis.address
        } else if (type === 'burn-v2') {
            advisorChainIdTo = this.omniPoolConfig.chainId
            const synthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)
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
        } else {
            // burn-v2-revert
            const synthesis = this.symbiosis.synthesis(chainIdFrom)
            calldata = synthesis.interface.encodeFunctionData('revertBurnAndBurn', [
                '0', // stableBridgingFee
                externalId,
                this.symbiosis.portal(chainIdTo).address, // _receiveSide
                this.symbiosis.bridge(chainIdTo).address, // _oppositeBridge
                chainIdTo, // _chainId
                revertableAddress, // _revertableAddress
            ])
            receiveSide = synthesis.address
        }

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: advisorChainIdFrom,
            chainIdTo: advisorChainIdTo,
        })

        const feeTokenAmount = new TokenAmount(feeToken, fee)
        if (this.request.originalFromTokenAmount.lessThan(feeTokenAmount)) {
            throw new Error(
                `Amount ${this.request.fromTokenAmount.toSignificant()} ${
                    this.request.fromTokenAmount.token.symbol
                } less than fee ${feeTokenAmount.toSignificant()} ${feeTokenAmount.token.symbol}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        return feeTokenAmount
    }

    private async getTransactionRequest(fee: TokenAmount, feeV2?: TokenAmount): Promise<TransactionRequest> {
        if (this.request.type === 'synthesize') {
            return this.getRevertSynthesizeTransactionRequest(fee)
        }

        if (this.request.type === 'synthesize-v2') {
            return this.getRevertSynthesizeTransactionRequestV2(fee)
        }

        if (this.request.type === 'burn') {
            return this.getRevertBurnTransactionRequest(fee)
        }

        if (this.request.type === 'burn-v2') {
            return await this.getRevertBurnTransactionRequestV2(fee, feeV2)
        }

        return await this.getRevertBurnTransactionRequestV2Revert(fee)
    }

    private getRevertSynthesizeTransactionRequestV2(fee: TokenAmount): TransactionRequest {
        const { internalId, chainIdFrom } = this.request
        const portal = this.symbiosis.portal(chainIdFrom)

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    internalID: internalId,
                    receiveSide: portal.address,
                    managerChainBridge: this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
                    managerChainId: this.omniPoolConfig.chainId,
                    sourceChainBridge: this.symbiosis.bridge(chainIdFrom).address,
                    sourceChainId: chainIdFrom,
                    sourceChainSynthesis: this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
                    router: AddressZero, // multicall router
                    swapCalldata: [], // swapCalldata,
                    burnToken: AddressZero, //burnToken,
                    burnCalldata: [], // burnCalldata,
                    clientID: this.symbiosis.clientId,
                },
            ]),
            chainId: chainIdFrom,
        }
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

    private getRevertBurnTransactionRequest(fee: TokenAmount): TransactionRequest {
        const { internalId, chainIdTo, chainIdFrom } = this.request

        const otherBridge = this.symbiosis.bridge(chainIdFrom)
        const portal = this.symbiosis.portal(chainIdTo)
        const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('revertBurnRequest', [
                fee.raw.toString(),
                internalId,
                otherSynthesis.address,
                otherBridge.address,
                chainIdFrom,
                this.symbiosis.clientId,
            ]),
            chainId: chainIdTo,
        }
    }

    private getSyntheticToken(realToken: Token): Token | undefined {
        return this.symbiosis.getRepresentation(realToken, this.omniPoolConfig.chainId)
    }

    private async buildSwapCalldata(fee?: TokenAmount): Promise<[string, string]> {
        const { originalFromTokenAmount, chainIdFrom, chainIdTo } = this.request

        const tokenIn = this.getSyntheticToken(this.transitTokenTo)
        if (!tokenIn) {
            throw new Error(`Cannot find synthetic token between mChain and ${chainIdTo}`)
        }
        const tokenAmountIn = new TokenAmount(tokenIn, originalFromTokenAmount.raw) // sStable -> Stable
        const amount = fee ? new TokenAmount(tokenIn, JSBI.subtract(tokenAmountIn.raw, fee.raw)) : tokenAmountIn

        const tokenOut = this.getSyntheticToken(this.transitTokenFrom)
        if (!tokenOut) {
            throw new Error(`Cannot find synthetic token between mChain and ${chainIdFrom}`)
        }

        const to = this.symbiosis.metaRouter(this.omniPoolConfig.chainId).address

        const omniTrade = new OmniTrade(
            amount,
            tokenOut,
            this.slippage,
            this.deadline,
            this.symbiosis,
            to,
            this.omniPoolConfig
        )
        await omniTrade.init()

        return [
            this.multicallRouter.address,
            this.multicallRouter.interface.encodeFunctionData('multicall', [
                amount.raw.toString(),
                [omniTrade.callData], // calldata
                [omniTrade.pool.address], // receiveSides
                [tokenIn.address, tokenOut.address], // path
                [100], // offset
                to,
            ]),
        ]
    }

    private async getRevertBurnTransactionRequestV2(
        fee: TokenAmount,
        feeV2?: TokenAmount
    ): Promise<TransactionRequest> {
        const { internalId, chainIdTo } = this.request

        const mChainBridge = this.symbiosis.bridge(this.omniPoolConfig.chainId)
        const portal = this.symbiosis.portal(chainIdTo)
        const mChainSynthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)

        const [router, swapCalldata] = await this.buildSwapCalldata(fee)
        const [burnToken, burnCalldata] = this.buildMetaBurnCalldata(feeV2)

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    internalID: internalId,
                    receiveSide: mChainSynthesis.address,
                    managerChainBridge: mChainBridge.address,
                    managerChainId: this.omniPoolConfig.chainId,
                    sourceChainBridge: AddressZero,
                    sourceChainId: this.request.chainIdFrom,
                    sourceChainSynthesis: mChainSynthesis.address,
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

    private async getRevertBurnTransactionRequestV2Revert(fee: TokenAmount): Promise<TransactionRequest> {
        const { internalId, chainIdTo } = this.request

        const portal = this.symbiosis.portal(chainIdTo)

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    internalID: internalId,
                    receiveSide: portal.address,
                    managerChainBridge: this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
                    managerChainId: this.omniPoolConfig.chainId,
                    sourceChainBridge: AddressZero,
                    sourceChainId: chainIdTo,
                    sourceChainSynthesis: this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
                    router: AddressZero, // multicall router
                    swapCalldata: [],
                    burnToken: AddressZero,
                    burnCalldata: '0x00', // any not empty calldata
                    clientID: this.symbiosis.clientId,
                },
            ]),
            chainId: chainIdTo,
        }
    }

    private async execute(transactionRequest: TransactionRequest, signer: Signer) {
        const preparedTransactionRequest = await prepareTransactionRequest(transactionRequest, signer)

        const transaction = await signer.sendTransaction(preparedTransactionRequest)

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
        const { type, internalId, chainIdTo, revertableAddress } = this.request

        let contractAddress: string
        if (type === 'synthesize' || type === 'synthesize-v2') {
            contractAddress = this.symbiosis.synthesis(chainIdTo).address
        } else {
            contractAddress = this.symbiosis.portal(chainIdTo).address
        }

        return getExternalId({ internalId, chainId: chainIdTo, revertableAddress, contractAddress })
    }
}

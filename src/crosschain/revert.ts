import { Filter, TransactionRequest } from '@ethersproject/providers'
import { MaxUint256 } from '@ethersproject/constants'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { BigNumberish, BytesLike, ContractTransaction, Signer } from 'ethers'
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
import { isTronChainId, prepareTronTransaction, TronTransactionData } from './tron'
import { TRON_PORTAL_ABI } from './tronAbis'

type RevertBase = {
    type: 'tron' | 'evm'
    fee: TokenAmount
}
export type EvmRevertResponse = RevertBase & {
    execute: (signer: Signer) => any
    transactionRequest: TransactionRequest
}

export type TronRevertResponse = RevertBase & {
    transactionRequest: TronTransactionData
}

export type RevertResponse = TronRevertResponse | EvmRevertResponse

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

    async revert(slippage: number, deadline: number): Promise<RevertResponse> {
        this.slippage = slippage
        this.deadline = deadline

        this.transitTokenFrom = await this.symbiosis.transitToken(this.request.chainIdFrom, this.omniPoolConfig)
        this.transitTokenTo = await this.symbiosis.transitToken(this.request.chainIdTo, this.omniPoolConfig)

        const fee = await this.getFee()

        const feeV2 = this.request.type === 'burn-v2' ? await this.getFeeV2() : undefined

        const transactionRequest = await this.getTransactionRequest(fee, feeV2)

        if ('call_value' in transactionRequest) {
            return {
                type: 'tron',
                fee,
                transactionRequest,
            }
        }

        return {
            type: 'evm',
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
            revertableAddress,
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
            revertableAddress,
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
            revertableAddress,
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
        const { from, chainIdFrom } = this.request

        const synthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)
        const synth = this.getSyntheticToken(this.transitTokenFrom)
        if (!synth) {
            throw new Error(`Cannot find synthetic token between mChain and ${chainIdFrom}`)
        }

        const metarouter = this.symbiosis.metaRouter(this.omniPoolConfig.chainId)

        let revertableAddress: string
        if (isTronChainId(chainIdFrom)) {
            revertableAddress = this.symbiosis.getRevertableAddress(chainIdFrom)
        } else {
            revertableAddress = from
        }

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
                revertableAddress,
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

    private async getTransactionRequest(
        fee: TokenAmount,
        feeV2?: TokenAmount
    ): Promise<TransactionRequest | TronTransactionData> {
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

    private getRevertSynthesizeTransactionRequestV2(fee: TokenAmount): TransactionRequest | TronTransactionData {
        const { internalId, chainIdFrom, revertableAddress } = this.request
        const portal = this.symbiosis.portal(chainIdFrom)

        const params = {
            stableBridgingFee: fee.raw.toString(),
            internalID: internalId,
            receiveSide: portal.address,
            managerChainBridge: this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
            sourceChainBridge: this.symbiosis.bridge(chainIdFrom).address,
            managerChainId: this.omniPoolConfig.chainId,
            sourceChainId: chainIdFrom,
            router: AddressZero, // multicall router
            swapCalldata: [], // swapCalldata,
            sourceChainSynthesis: this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
            burnToken: AddressZero, //burnToken,
            burnCalldata: [], // burnCalldata,
            clientID: this.symbiosis.clientId,
        }

        if (isTronChainId(chainIdFrom)) {
            return prepareTronTransaction({
                chainId: chainIdFrom,
                tronWeb: this.symbiosis.tronWeb(chainIdFrom),
                abi: TRON_PORTAL_ABI,
                contractAddress: portal.address,
                functionName: 'metaRevertRequest',
                params: [
                    [
                        fee.raw.toString(),
                        internalId,
                        portal.address,
                        this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
                        this.symbiosis.bridge(chainIdFrom).address,
                        this.omniPoolConfig.chainId,
                        chainIdFrom,
                        AddressZero, // multicall router
                        [], // swapCalldata,
                        this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
                        AddressZero, //burnToken,
                        [], // burnCalldata,
                        this.symbiosis.clientId,
                    ],
                ],
                ownerAddress: revertableAddress,
                value: 0,
            })
        }

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [params]),
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

    private getRevertBurnTransactionRequest(fee: TokenAmount): TransactionRequest | TronTransactionData {
        const { internalId, chainIdTo, chainIdFrom } = this.request

        const otherBridge = this.symbiosis.bridge(chainIdFrom)
        const portal = this.symbiosis.portal(chainIdTo)
        const otherSynthesis = this.symbiosis.synthesis(chainIdFrom)

        const params = [
            fee.raw.toString(),
            internalId,
            otherSynthesis.address,
            otherBridge.address,
            chainIdFrom,
            this.symbiosis.clientId,
        ] as [BigNumberish, BytesLike, string, string, BigNumberish, BytesLike]

        if (isTronChainId(chainIdTo)) {
            return prepareTronTransaction({
                chainId: chainIdTo,
                tronWeb: this.symbiosis.tronWeb(chainIdTo),
                abi: TRON_PORTAL_ABI,
                contractAddress: portal.address,
                functionName: 'revertBurnRequest',
                params,
                ownerAddress: this.request.revertableAddress,
                value: 0,
            })
        }

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('revertBurnRequest', params),
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
            amount, // amountInMin
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
    ): Promise<TransactionRequest | TronTransactionData> {
        const { internalId, chainIdTo } = this.request

        const mChainBridge = this.symbiosis.bridge(this.omniPoolConfig.chainId)
        const portal = this.symbiosis.portal(chainIdTo)
        const mChainSynthesis = this.symbiosis.synthesis(this.omniPoolConfig.chainId)

        const [router, swapCalldata] = await this.buildSwapCalldata(fee)
        const [burnToken, burnCalldata] = this.buildMetaBurnCalldata(feeV2)

        const params = {
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
        }

        if (isTronChainId(chainIdTo)) {
            return prepareTronTransaction({
                chainId: chainIdTo,
                tronWeb: this.symbiosis.tronWeb(chainIdTo),
                abi: TRON_PORTAL_ABI,
                contractAddress: portal.address,
                functionName: 'metaRevertRequest',
                params: [
                    [
                        fee.raw.toString(),
                        internalId,
                        mChainSynthesis.address,
                        mChainBridge.address,
                        this.omniPoolConfig.chainId,
                        AddressZero,
                        this.request.chainIdFrom,
                        mChainSynthesis.address,
                        router, // multicall router
                        swapCalldata,
                        burnToken,
                        burnCalldata,
                        this.symbiosis.clientId,
                    ],
                ],
                ownerAddress: this.request.revertableAddress, // correct??
                value: 0,
            })
        }

        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [params]),
            chainId: chainIdTo,
        }
    }

    private async getRevertBurnTransactionRequestV2Revert(
        fee: TokenAmount
    ): Promise<TransactionRequest | TronTransactionData> {
        const { internalId, chainIdTo } = this.request

        const portal = this.symbiosis.portal(chainIdTo)

        const params = {
            stableBridgingFee: fee.raw.toString(),
            internalID: internalId,
            receiveSide: portal.address,
            managerChainBridge: this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
            sourceChainBridge: AddressZero,
            managerChainId: this.omniPoolConfig.chainId,
            sourceChainId: chainIdTo,
            router: AddressZero, // multicall router
            swapCalldata: [],
            sourceChainSynthesis: this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
            burnToken: AddressZero,
            burnCalldata: '0x00', // any not empty calldata
            clientID: this.symbiosis.clientId,
        }

        if (isTronChainId(chainIdTo)) {
            return prepareTronTransaction({
                chainId: chainIdTo,
                tronWeb: this.symbiosis.tronWeb(chainIdTo),
                abi: TRON_PORTAL_ABI,
                contractAddress: portal.address,
                functionName: 'metaRevertRequest',
                params: [
                    [
                        fee.raw.toString(),
                        internalId,
                        portal.address,
                        this.symbiosis.bridge(this.omniPoolConfig.chainId).address,
                        AddressZero,
                        this.omniPoolConfig.chainId,
                        chainIdTo,
                        AddressZero, // multicall router
                        [],
                        this.symbiosis.synthesis(this.omniPoolConfig.chainId).address,
                        AddressZero,
                        '0x00', // any not empty calldata
                        this.symbiosis.clientId,
                    ],
                ],
                ownerAddress: this.request.revertableAddress,
                value: 0,
            })
        }
        return {
            to: portal.address,
            data: portal.interface.encodeFunctionData('metaRevertRequest', [params]),
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

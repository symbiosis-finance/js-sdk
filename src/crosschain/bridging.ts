import { MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { BigNumber, Signer } from 'ethers'
import { Token, TokenAmount, wrappedToken } from '../entities'
import type { Symbiosis } from './symbiosis'
import { isTronToken, prepareTronTransaction, tronAddressToEvm, TronTransactionData } from './tron'
import { TRON_PORTAL_ABI } from './tronAbis'
import { BridgeDirection } from './types'
import { getExternalId, getInternalId, prepareTransactionRequest } from './utils'
import { WaitForComplete } from './waitForComplete'
import { Error, ErrorCode } from './error'
import { Portal__factory, Synthesis__factory } from './contracts'

export type RequestNetworkType = 'evm' | 'tron'

export type WaitForMined = Promise<{
    receipt: TransactionReceipt
    waitForComplete: () => Promise<Log>
}>

export type Execute = Promise<{
    response: TransactionResponse
    waitForMined: () => WaitForMined
}>

export type BridgeExactIn = Promise<
    {
        fee: TokenAmount
        tokenAmountOut: TokenAmount
    } & (
        | {
              type: 'evm'
              execute: (signer: Signer) => Execute
              transactionRequest: TransactionRequest
          }
        | {
              type: 'tron'
              transactionRequest: TronTransactionData
          }
    )
>

export type BridgeExactInParams = {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
}

export class Bridging {
    public tokenAmountIn: TokenAmount | undefined
    public tokenOut: Token | undefined
    public tokenAmountOut: TokenAmount | undefined
    public direction!: BridgeDirection
    public from!: string
    public to!: string
    public revertableAddress!: string

    private readonly symbiosis: Symbiosis

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
    }

    public async exactIn({ from, tokenAmountIn, tokenOut, to }: BridgeExactInParams): BridgeExactIn {
        this.symbiosis.validateSwapAmounts(tokenAmountIn)

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = tronAddressToEvm(from)
        this.to = tronAddressToEvm(to)
        this.direction = tokenAmountIn.token.isSynthetic ? 'burn' : 'mint'

        if (isTronToken(this.tokenAmountIn.token) || isTronToken(this.tokenOut)) {
            this.revertableAddress = this.symbiosis.getRevertableAddress(this.tokenOut.chainId)
        } else {
            this.revertableAddress = this.from
        }

        const fee = await this.getFee()

        const tokenAmountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        if (tokenAmountOut.lessThan(fee)) {
            throw new Error(
                `Amount ${tokenAmountOut.toSignificant()} ${
                    tokenAmountOut.token.symbol
                } less than fee ${fee.toSignificant()} ${fee.token.symbol}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        this.tokenAmountOut = tokenAmountOut.subtract(fee)

        if (isTronToken(this.tokenAmountIn.token)) {
            const transactionRequest = this.getTronTransactionRequest(fee)

            return {
                fee,
                tokenAmountOut: this.tokenAmountOut,
                transactionRequest,
                type: 'tron',
            }
        }

        const transactionRequest = this.getEvmTransactionRequest(fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee,
            tokenAmountOut: this.tokenAmountOut,
            transactionRequest,
            type: 'evm',
        }
    }

    protected async getFee(): Promise<TokenAmount> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        if (this.direction === 'mint') {
            return await this.getMintFee()
        }

        return await this.getBurnFee()
    }

    protected async execute(transactionRequest: TransactionRequest, signer: Signer): Execute {
        const preparedTransactionRequest = await prepareTransactionRequest(transactionRequest, signer)

        const response = await signer.sendTransaction(preparedTransactionRequest)

        return {
            response,
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, response),
        }
    }

    protected async waitForMined(confirmations: number, response: TransactionResponse): WaitForMined {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(receipt),
        }
    }

    protected getTronTransactionRequest(fee: TokenAmount): TronTransactionData {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const { chainId } = this.tokenAmountIn.token

        const portalAddress = this.symbiosis.chainConfig(chainId).portal

        if (this.direction === 'burn') {
            throw new Error('Burn is not supported on Tron')
        }

        return prepareTronTransaction({
            chainId,
            abi: TRON_PORTAL_ABI,
            ownerAddress: this.from,
            contractAddress: portalAddress,
            functionName: 'synthesize',
            params: [
                fee.raw.toString(),
                this.tokenAmountIn.token.address,
                this.tokenAmountIn.raw.toString(),
                this.to,
                this.symbiosis.synthesis(this.tokenOut.chainId).address,
                this.symbiosis.bridge(this.tokenOut.chainId).address,
                this.revertableAddress,
                this.tokenOut.chainId.toString(),
                this.symbiosis.clientId,
            ],
            tronWeb: this.symbiosis.tronWeb(chainId),
        })
    }

    protected getEvmTransactionRequest(fee: TokenAmount): TransactionRequest {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const { chainId } = this.tokenAmountIn.token

        // burn
        if (this.direction === 'burn') {
            const synthesis = this.symbiosis.synthesis(chainId)

            const portalAddress = this.symbiosis.chainConfig(this.tokenOut.chainId).portal
            const bridgeAddress = this.symbiosis.chainConfig(this.tokenOut.chainId).bridge

            return {
                chainId,
                to: synthesis.address,
                data: synthesis.interface.encodeFunctionData('burnSyntheticToken', [
                    fee.raw.toString(),
                    this.tokenAmountIn.token.address,
                    this.tokenAmountIn.raw.toString(),
                    this.to,
                    portalAddress,
                    bridgeAddress,
                    this.revertableAddress,
                    this.tokenOut.chainId,
                    this.symbiosis.clientId,
                ]),
            }
        }

        const portal = this.symbiosis.portal(chainId)

        if (this.tokenAmountIn.token.isNative) {
            return {
                chainId,
                to: portal.address,
                data: portal.interface.encodeFunctionData('synthesizeNative', [
                    fee.raw.toString(),
                    this.to,
                    this.symbiosis.synthesis(this.tokenOut.chainId).address,
                    this.symbiosis.bridge(this.tokenOut.chainId).address,
                    this.revertableAddress,
                    this.tokenOut.chainId,
                    this.symbiosis.clientId,
                ]),
                value: BigNumber.from(this.tokenAmountIn.raw.toString()),
            }
        }

        return {
            chainId,
            to: portal.address,
            data: portal.interface.encodeFunctionData('synthesize', [
                fee.raw.toString(),
                this.tokenAmountIn.token.address,
                this.tokenAmountIn.raw.toString(),
                this.to,
                this.symbiosis.synthesis(this.tokenOut.chainId).address,
                this.symbiosis.bridge(this.tokenOut.chainId).address,
                this.revertableAddress,
                this.tokenOut.chainId,
                this.symbiosis.clientId,
            ]),
        }
    }

    private async getMintFee(): Promise<TokenAmount> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const portalAddress = this.symbiosis.chainConfig(chainIdIn).portal
        const synthesisAddress = this.symbiosis.chainConfig(chainIdOut).synthesis

        const synthesisInterface = Synthesis__factory.createInterface()

        const internalId = getInternalId({
            contractAddress: portalAddress,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesisAddress,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const token = wrappedToken(this.tokenAmountIn.token)

        const calldata = synthesisInterface.encodeFunctionData('mintSyntheticToken', [
            '1', // _stableBridgingFee,
            externalId, // externalID,
            token.address, // _token,
            chainIdIn, // block.chainid,
            this.tokenAmountIn.raw.toString(), // _amount,
            this.to, // _chain2address
        ])

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: synthesisAddress,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: this.tokenOut.chainId,
        })

        return new TokenAmount(this.tokenOut, fee.toString())
    }

    private async getBurnFee(): Promise<TokenAmount> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesis = this.symbiosis.synthesis(chainIdIn)
        const portalAddress = this.symbiosis.chainConfig(chainIdOut).portal

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portalAddress,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const portalInterface = Portal__factory.createInterface()
        const calldata = portalInterface.encodeFunctionData('unsynthesize', [
            '1', // _stableBridgingFee,
            externalId, // externalID,
            this.tokenOut.address, // rtoken,
            this.tokenAmountIn.raw.toString(), // _amount,
            this.to, // _chain2address
        ])

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: portalAddress,
            calldata,
            chainIdFrom: chainIdIn,
            chainIdTo: chainIdOut,
        })

        return new TokenAmount(this.tokenOut, fee.toString())
    }

    async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        return new WaitForComplete({
            direction: this.direction,
            chainIdOut: this.tokenOut.chainId,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }
}

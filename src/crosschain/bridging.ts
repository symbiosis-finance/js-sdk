import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { MaxUint256 } from '@ethersproject/constants'
import { BigNumber, Signer, utils } from 'ethers'
import { Token, TokenAmount } from '../entities'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { calculateGasMargin, getExternalId, getInternalId } from './utils'
import { WaitForComplete } from './waitForComplete'
import { Account, Contract } from 'near-api-js'

export type WaitForMined = Promise<{
    receipt: TransactionReceipt
    waitForComplete: () => Promise<Log>
}>

export type Execute = Promise<{
    response: TransactionResponse
    waitForMined: () => WaitForMined
}>

export type ExactIn = Promise<{
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    transactionRequest: TransactionRequest
    nearExecute?: (account: Account) => Promise<void>
}>

export class Bridging {
    public tokenAmountIn: TokenAmount | undefined
    public tokenOut: Token | undefined
    public tokenAmountOut: TokenAmount | undefined
    public direction!: BridgeDirection
    public to!: string
    public revertableAddress!: string

    protected fee: TokenAmount | undefined

    private readonly symbiosis: Symbiosis

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
    }

    public async exactIn(tokenAmountIn: TokenAmount, tokenOut: Token, to: string, revertableAddress: string): ExactIn {
        if (this.tokenAmountIn?.token !== tokenAmountIn.token || this.tokenOut !== tokenOut) {
            this.fee = undefined
        }

        this.symbiosis.validateSwapAmounts(tokenAmountIn)

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.revertableAddress = revertableAddress
        this.direction = tokenAmountIn.token.isSynthetic ? 'burn' : 'mint'

        if (!this.fee) {
            this.fee = await this.getFee()
        }

        const tokenAmountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        if (tokenAmountOut.lessThan(this.fee)) {
            throw new Error('Amount out less than fee')
        }

        this.tokenAmountOut = tokenAmountOut.subtract(this.fee)

        if (tokenAmountIn.token.isFromNear()) {
            return {
                execute: (signer: Signer) => this.execute({}, signer),
                fee: this.fee,
                tokenAmountOut: this.tokenAmountOut,
                transactionRequest: {},
                nearExecute: (account: Account) => this.nearExecute(account),
            }
        }

        const transactionRequest = this.getTransactionRequest(this.fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee: this.fee,
            tokenAmountOut: this.tokenAmountOut,
            transactionRequest,
        }
    }

    protected async getFee(): Promise<TokenAmount> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        if (this.tokenAmountIn.token.isFromNear() || this.tokenOut.isFromNear()) {
            return new TokenAmount(this.tokenOut, '1000000') // @@ fake
        }

        if (this.direction === 'mint') {
            return await this.getMintFee()
        }

        return await this.getBurnFee()
    }

    protected async nearExecute(account: Account): Promise<void> {
        if (!this.tokenAmountIn || !this.tokenOut || !this.fee) {
            throw new Error('Tokens are not set')
        }

        const token = new Contract(account, 'usdc.fakes.testnet', {
            viewMethods: [],
            changeMethods: ['ft_transfer_call'],
        }) as Contract & { ft_transfer_call: any }

        const bridge = this.symbiosis.bridge(this.tokenOut.chainId).address
        const synthesis = this.symbiosis.synthesis(this.tokenOut.chainId).address
        const amount = this.tokenAmountIn.raw.toString()

        await token.ft_transfer_call(
            {
                receiver_id: 'portal.symbiosis-finance.testnet',
                amount,
                msg: JSON.stringify({
                    Synthesize: {
                        amount,
                        stable_bridging_fee: this.fee.raw.toString(),
                        token: this.tokenAmountIn.token.address,
                        chain_to_address: utils.base64.encode(this.to), // получатель в евм
                        opposite_bridge: utils.base64.encode(bridge), // адрес бриджа
                        receive_side: utils.base64.encode(synthesis), // адрес синтезиса
                        revertable_address: account.accountId, // мой адрес
                        chain_id: this.tokenOut.chainId.toString(), // идентификатор блокчейна
                    },
                }),
            },
            '300000000000000', // attached GAS (optional)
            '1' // attached deposit in yoctoNEAR (optional)
        )
    }

    protected async execute(transactionRequest: TransactionRequest, signer: Signer): Execute {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequestWithGasLimit)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const response = await signer.sendTransaction(transactionRequestWithGasLimit)

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

    protected getTransactionRequest(fee: TokenAmount): TransactionRequest {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const { chainId } = this.tokenAmountIn.token

        // burn
        if (this.direction === 'burn') {
            const synthesis = this.symbiosis.synthesis(chainId)

            return {
                chainId,
                to: synthesis.address,
                data: synthesis.interface.encodeFunctionData('burnSyntheticToken', [
                    fee.raw.toString(),
                    this.tokenAmountIn.token.address,
                    this.tokenAmountIn.raw.toString(),
                    this.to,
                    this.symbiosis.portal(this.tokenOut.chainId).address,
                    this.symbiosis.bridge(this.tokenOut.chainId).address,
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

        const portal = this.symbiosis.portal(chainIdIn)

        const synthesis = this.symbiosis.synthesis(chainIdOut)

        const internalId = getInternalId({
            contractAddress: portal.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesis.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const calldata = synthesis.interface.encodeFunctionData('mintSyntheticToken', [
            '1', // _stableBridgingFee,
            externalId, // externalID,
            this.tokenAmountIn.token.address, // _token,
            chainIdIn, // block.chainid,
            this.tokenAmountIn.raw.toString(), // _amount,
            this.to, // _chain2address
        ])

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: synthesis.address,
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
        const portal = this.symbiosis.portal(chainIdOut)

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portal.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const calldata = portal.interface.encodeFunctionData('unsynthesize', [
            '1', // _stableBridgingFee,
            externalId, // externalID,
            this.tokenOut.address, // rtoken,
            this.tokenAmountIn.raw.toString(), // _amount,
            this.to, // _chain2address
        ])

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: portal.address,
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
            tokenOut: this.tokenOut,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }
}

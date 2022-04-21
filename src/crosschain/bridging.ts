import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Wallet as TerraWallet, MsgExecuteContract, Coins, SyncTxBroadcastResult } from '@terra-money/terra.js'
import { BigNumber, Signer } from 'ethers'
import { isTerraChainId } from '../utils'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import {
    calculateGasMargin,
    getExternalId,
    getInternalId,
    getTerraExternalId,
    getTerraInternalId,
    getTerraTokenFullAddress,
    terraAddressToEthAddress,
} from './utils'
import { WaitForComplete } from './waitForComplete'
import { formatBytes32String } from '@ethersproject/strings'
import { Synthesis, SynthesisNonEvm } from './contracts'
import { utils } from 'ethers'
import { hexZeroPad } from '@ethersproject/bytes'

export type WaitForMined = Promise<{
    receipt: TransactionReceipt
    waitForComplete: () => Promise<Log>
}>

export type Execute = Promise<{
    response: TransactionResponse
    waitForMined: () => WaitForMined
}>

interface EvmExactIn {
    chainType: 'evm'
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    transactionRequest: TransactionRequest
}

interface TerraExactIn {
    chainType: 'terra'
    execute: (wallet: TerraWallet) => Promise<SyncTxBroadcastResult>
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    executeMessage: TerraBridgeExecuteMessage
}

interface TerraExecuteMessagePayload {
    amount: string
    target: string
    chain_id: string
    asset_info:
        | {
              cw20_token: {
                  address: string
              }
          }
        | {
              native_coin: {
                  denom: string
              }
          }
    opposite_bridge: string
    opposite_synthesis: string
}

interface TerraUnsynthesizeExecuteMessage {
    unsynthesize: TerraExecuteMessagePayload
}

interface TerraSynthesizeExecuteMessage {
    synthesize: TerraExecuteMessagePayload
}

type TerraBridgeExecuteMessage = TerraUnsynthesizeExecuteMessage | TerraSynthesizeExecuteMessage

export type ExactIn = Promise<EvmExactIn | TerraExactIn>

const TERRA_PORTAL = 'terra19zr9wkkdx3zepzyv9geqttnven2ndczjdysk2h' // @@ portal address

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

        const fee = this.fee || (await this.getFee())

        this.fee = fee

        const tokenAmountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        if (tokenAmountOut.lessThan(this.fee)) {
            throw new Error('Amount out less than fee')
        }

        this.tokenAmountOut = tokenAmountOut.subtract(this.fee)

        if (tokenAmountIn.token.isFromTerra()) {
            const executeMessage = this.getTerraExecuteMessage()

            return {
                chainType: 'terra',
                executeMessage,
                execute: (wallet: TerraWallet) => this.executeTerra(executeMessage, wallet),
                fee,
                tokenAmountOut,
            }
        }

        const transactionRequest = this.getEvmTransactionRequest(fee)

        return {
            chainType: 'evm',
            execute: (signer: Signer) => this.executeEvm(transactionRequest, signer),
            fee,
            tokenAmountOut: this.tokenAmountOut,
            transactionRequest,
        }
    }

    protected async getFee(): Promise<TokenAmount> {
        if (this.direction === 'mint') {
            return await this.getMintFee()
        }

        return await this.getBurnFee()
    }

    protected async executeEvm(transactionRequest: TransactionRequest, signer: Signer): Execute {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequestWithGasLimit)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const response = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            response,
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, response),
        }
    }

    protected async executeTerra(
        executeMessage: TerraBridgeExecuteMessage,
        wallet: TerraWallet
    ): Promise<SyncTxBroadcastResult> {
        if (!this.tokenAmountIn) {
            throw new Error('Tokens are not set')
        }

        const payload = 'synthesize' in executeMessage ? executeMessage.synthesize : executeMessage.unsynthesize

        let coins: Coins.Input | undefined
        if ('native_coin' in payload.asset_info) {
            coins = { [payload.asset_info.native_coin.denom]: this.tokenAmountIn.toFixed() }
        }

        const execute = new MsgExecuteContract(
            wallet.key.accAddress,
            TERRA_PORTAL, // @@
            { ...executeMessage },
            coins
        )

        const executeTx = await wallet.createAndSignTx({
            msgs: [execute],
        })

        const lcdcClient = this.symbiosis.getTerraLCDClient(ChainId.TERRA_TESTNET)

        return lcdcClient.tx.broadcastSync(executeTx)
    }

    protected async waitForMined(confirmations: number, response: TransactionResponse): WaitForMined {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(receipt),
        }
    }

    // @@ Wrong Unsynthesize params
    protected getTerraExecuteMessage(): TerraBridgeExecuteMessage {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const tokenIn = this.tokenAmountIn.token

        if (!tokenIn.symbol) {
            throw new Error('Token symbol is not set')
        }

        const payload: TerraExecuteMessagePayload = {
            amount: this.tokenAmountIn.raw.toString(),
            target: this.to,
            chain_id: this.tokenOut.chainId.toString(),
            asset_info: tokenIn.isNative
                ? {
                      native_coin: { denom: tokenIn.symbol },
                  }
                : {
                      cw20_token: { address: tokenIn.address },
                  },
            opposite_bridge: this.symbiosis.bridge(this.tokenOut.chainId).address,
            opposite_synthesis: this.symbiosis.portal(this.tokenOut.chainId).address,
        }

        if (this.direction === 'mint') {
            return { synthesize: payload }
        }

        return { unsynthesize: payload }
    }

    protected getEvmTransactionRequest(fee: TokenAmount): TransactionRequest {
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
            ]),
        }
    }

    private async getMintFee(): Promise<TokenAmount> {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        if (isTerraChainId(chainIdOut)) {
            throw new Error(`Terra doesn't support minting yet`)
        }

        if (isTerraChainId(chainIdIn)) {
            const lcdClient = this.symbiosis.getTerraLCDClient(chainIdIn)
            const queryResult = await lcdClient.wasm.contractQuery<{ request_count: number }>(TERRA_PORTAL, {
                get_request_count: {},
            })

            const synthesis = this.symbiosis.synthesisNonEvm(chainIdOut)

            const internalId = getTerraInternalId({
                contractAddress: TERRA_PORTAL,
                requestCount: queryResult.request_count,
                chainId: chainIdIn,
            })

            const externalId = getTerraExternalId({
                internalId,
                contractAddress: synthesis.address,
                revertableAddress: this.revertableAddress,
                chainId: chainIdOut,
            })

            const calldata = synthesis.interface.encodeFunctionData('mintSyntheticToken', [
                '1', // _stableBridgingFee,
                externalId, // externalID,
                // @@ Add 0x1 and 0x0 prefixes
                formatBytes32String(this.tokenAmountIn.token.address), // _token,
                chainIdIn, // block.chainid,
                this.tokenAmountIn.raw.toString(), // _amount,
                this.to, // _chain2address
            ])

            // @@
            console.log({ internalId, externalId, calldata })

            const fee = await this.symbiosis.getBridgeFee({
                receiveSide: synthesis.address,
                calldata,
                chainIdFrom: this.tokenAmountIn.token.chainId,
                chainIdTo: this.tokenOut.chainId,
            })

            // @@ Get fee from advisor
            return new TokenAmount(this.tokenOut, fee.toString())
        }

        const portal = this.symbiosis.portal(chainIdIn)
        const portalRequestCountBN = await portal.requestCount()

        const contractAddress = portal.address
        const requestCount = portalRequestCountBN.toNumber()

        const internalId = getInternalId({ contractAddress, requestCount, chainId: chainIdIn })

        const synthesis = this.symbiosis.synthesis(chainIdOut)
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

        if (isTerraChainId(chainIdIn)) {
            throw new Error(`Burning tokens from Terra is not supported yet`)
        }

        let synthesis: SynthesisNonEvm | Synthesis
        let portalAddress: string
        let revertableAddress: string
        if (isTerraChainId(chainIdOut)) {
            synthesis = this.symbiosis.synthesis(chainIdIn)
            portalAddress = terraAddressToEthAddress(TERRA_PORTAL)
            revertableAddress = terraAddressToEthAddress(this.revertableAddress)
        } else {
            synthesis = this.symbiosis.synthesisNonEvm(chainIdIn)
            portalAddress = this.symbiosis.portal(chainIdOut).address
            revertableAddress = this.revertableAddress
        }

        const synthesisRequestsCount = (await synthesis.requestCount()).toNumber()

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: synthesisRequestsCount,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portalAddress,
            revertableAddress,
            chainId: chainIdOut,
        })

        let calldata: string
        if (this.tokenOut.isFromTerra()) {
            const portalNonEvm = new utils.Interface([
                'function unsynthesize(uint256 _stableBridgingFee, bytes32 externalID, bytes32 rtoken, uint256 _amount, bytes32 _chain2address)',
            ])

            calldata = portalNonEvm.encodeFunctionData('unsynthesize', [
                '1',
                externalId,
                getTerraTokenFullAddress(this.tokenOut),
                this.tokenAmountIn.raw.toString(),
                hexZeroPad(terraAddressToEthAddress(this.to), 32),
            ])
        } else {
            const portal = this.symbiosis.portal(chainIdOut)

            calldata = portal.interface.encodeFunctionData('unsynthesize', [
                '1', // _stableBridgingFee,
                externalId, // externalID,
                this.tokenOut.address, // rtoken,
                this.tokenAmountIn.raw.toString(), // _amount,
                this.to, // _chain2address
            ])
        }

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: isTerraChainId(chainIdOut) ? TERRA_PORTAL : this.symbiosis.portal(chainIdOut).address,
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

import { hexZeroPad } from '@ethersproject/bytes'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Coin, Coins, MsgExecuteContract, SyncTxBroadcastResult } from '@terra-money/terra.js'
import { ConnectedWallet } from '@terra-money/wallet-types'
import { BigNumber, Signer, utils } from 'ethers'
import { base64 } from 'ethers/lib/utils'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { isTerraChainId } from '../utils'
import { Synthesis, SynthesisNonEvm } from './contracts'
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

export type WaitForMined = Promise<{
    receipt: TransactionReceipt
    waitForComplete: () => Promise<Log>
}>

export type ExecuteEvm = Promise<{
    response: TransactionResponse
    waitForMined: () => WaitForMined
}>

export type ExecuteTerra = Promise<{
    response: SyncTxBroadcastResult
    // waitForMined: () => WaitForMined
}>

interface TerraSynthesizeExecuteMessage {
    synthesize: {
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
}

interface EvmExactIn {
    chainType: 'evm'
    execute: (signer: Signer) => ExecuteEvm
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    transactionRequest: TransactionRequest
}

interface TerraExactIn {
    chainType: 'terra'
    execute: (wallet: ConnectedWallet) => ExecuteTerra
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    executeMessage: TerraSynthesizeExecuteMessage
}

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
            const executeMessage = this.getTerraSynthesizeExecuteMessage()

            console.log(JSON.stringify(executeMessage, undefined, 2))

            return {
                chainType: 'terra',
                executeMessage,
                execute: (wallet: ConnectedWallet) => this.executeTerra(executeMessage, wallet),
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

    protected async executeEvm(transactionRequest: TransactionRequest, signer: Signer): ExecuteEvm {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequestWithGasLimit)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const response = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            response,
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, response),
        }
    }

    protected async executeTerra(executeMessage: TerraSynthesizeExecuteMessage, wallet: ConnectedWallet): ExecuteTerra {
        if (!this.tokenAmountIn) {
            throw new Error('Tokens are not set')
        }

        let coins: Coins.Input | undefined
        if ('native_coin' in executeMessage.synthesize.asset_info) {
            coins = [
                new Coin(executeMessage.synthesize.asset_info.native_coin.denom, this.tokenAmountIn.raw.toString()),
            ]
        }

        const execute = new MsgExecuteContract(
            wallet.terraAddress,
            TERRA_PORTAL, // @@
            executeMessage,
            coins
        )

        const signResult = await wallet.sign({ msgs: [execute] })

        const lcdcClient = this.symbiosis.getTerraLCDClient(ChainId.TERRA_TESTNET)

        const response = await lcdcClient.tx.broadcastSync(signResult.result)

        return {
            response,
        }
    }

    protected async waitForMined(confirmations: number, response: TransactionResponse): WaitForMined {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(receipt),
        }
    }

    protected getTerraSynthesizeExecuteMessage(): TerraSynthesizeExecuteMessage {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const tokenIn = this.tokenAmountIn.token

        if (!tokenIn.symbol) {
            throw new Error('Token symbol is not set')
        }

        return {
            synthesize: {
                amount: this.tokenAmountIn.raw.toString(),
                target: base64.encode(this.to),
                chain_id: this.tokenOut.chainId.toString(),
                asset_info: tokenIn.isNative
                    ? { native_coin: { denom: tokenIn.address } }
                    : { cw20_token: { address: tokenIn.address } },
                opposite_bridge: this.symbiosis.bridge(this.tokenOut.chainId).address,
                opposite_synthesis: this.symbiosis.portal(this.tokenOut.chainId).address,
            },
        }
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
                getTerraTokenFullAddress(this.tokenAmountIn.token), // _token,
                chainIdIn, // block.chainid,
                this.tokenAmountIn.raw.toString(), // _amount,
                this.to, // _chain2address
            ])

            console.log(calldata)

            // const fee = await this.symbiosis.getBridgeFee({
            //     receiveSide: synthesis.address,
            //     calldata,
            //     chainIdFrom: this.tokenAmountIn.token.chainId,
            //     chainIdTo: this.tokenOut.chainId,
            // })

            return new TokenAmount(this.tokenOut, '100000')
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

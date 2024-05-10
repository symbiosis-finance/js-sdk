import { SwapExactInParams, SwapExactInResult } from './types'
import { Token, TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { OmniTrade } from '../trade'
import { CROSS_CHAIN_ID } from '../constants'
import { Symbiosis } from '../symbiosis'

export const BTC_FORWARDER_API = {
    testnet: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
    mainnet: 'https://relayers.symbiosis.finance/forwarder/api/v1',
}

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount } = context

    return isBtc(inTokenAmount.token.chainId)
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { evmAccount, inTokenAmount, outToken, symbiosis, toAddress } = context

    if (!evmAccount || (evmAccount && !isAddress(evmAccount))) {
        throw new Error('fromBtcSwap: No EVM address was provided')
    }

    // 1) [TODO]: Fee 2-nd synthesis, 3-rd from advisor in btc
    // 2) tail to next swap on evm

    let tail = ''
    if (!symbiosis.getRepresentation(inTokenAmount.token, outToken.chainId)?.equals(outToken)) {
        const { address: secondDexRouter, data: secondSwapCalldata, route: swapTokens } = await _buildPoolTrade(context)

        const {
            address: finalReceiveSide,
            data: finalCalldata,
            offset: finalOffset,
        } = await _metaBurnSyntheticToken(symbiosis, swapTokens[swapTokens.length - 1], toAddress)

        const symBtcContract = symbiosis.symBtc(swapTokens[0].chainId)
        const params = {
            swapTokens: swapTokens.map((i) => i.address),
            secondDexRouter,
            secondSwapCalldata,
            finalReceiveSide,
            finalCalldata,
            finalOffset,
        }
        tail = await symBtcContract.callStatic.packBTCTransactionTail(params)
    }
    const btcForwarderFeeRaw = await _getBtcForwarderFee(evmAccount, tail)
    const { validUntil, revealAddress } = await _getDepositAddresses(evmAccount, btcForwarderFeeRaw, tail)

    const btcForwarderFee = new TokenAmount(inTokenAmount.token, btcForwarderFeeRaw)

    const totalTokenAmountOut = inTokenAmount.subtract(btcForwarderFee) //[TODO]: minus all fees
    const tokenAmountOut = new TokenAmount(outToken, totalTokenAmountOut.raw)

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut,
        },
        route: [inTokenAmount.token, outToken],
        tokenAmountOut,
        approveTo: AddressZero,
        inTradeType: undefined,
        outTradeType: undefined,
        amountInUsd: undefined,
        fee: btcForwarderFee,
        save: undefined,
        extraFee: undefined,
    }
}

interface MetaBurnSyntheticTokenResult {
    address: string
    data: string
    offset: number
}
async function _metaBurnSyntheticToken(
    symbiosis: Symbiosis,
    tokenToBurn: Token,
    toAddress: string
): Promise<MetaBurnSyntheticTokenResult> {
    if (!tokenToBurn.chainFromId) {
        throw new Error('_buildFinalSwap: token is not synthetic')
    }
    const chainIdTo = tokenToBurn.chainFromId

    const synthesis = symbiosis.synthesis(tokenToBurn.chainId)
    const data = synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
        {
            stableBridgingFee: '0', // TODO
            amount: '0', // to be patched
            syntCaller: symbiosis.metaRouter(tokenToBurn.chainId).address,
            crossChainID: CROSS_CHAIN_ID,
            finalReceiveSide: AddressZero, // TODO
            sToken: tokenToBurn.address,
            finalCallData: [], // TODO
            finalOffset: 0, // TODO
            chain2address: toAddress,
            receiveSide: symbiosis.portal(chainIdTo).address,
            oppositeBridge: symbiosis.bridge(chainIdTo).address,
            revertableAddress: symbiosis.getRevertableAddress(chainIdTo),
            chainID: chainIdTo,
            clientID: symbiosis.clientId,
        },
    ])

    return {
        address: synthesis.address,
        data: data,
        offset: 100,
    }
}

interface SecondSwapResult {
    address: string
    data: string
    route: Token[]
}

async function _buildPoolTrade(context: SwapExactInParams): Promise<SecondSwapResult> {
    const { symbiosis, inTokenAmount, outToken, slippage, deadline, toAddress } = context

    const pool = symbiosis.getOmniPoolByToken(inTokenAmount.token)
    if (!pool) {
        throw new Error('fromBtcSwap: Pool not found')
    }
    const poolOut = symbiosis.getOmniPoolByToken(outToken)
    if (!poolOut) {
        throw new Error('fromBtcSwap: poolOut not found')
    }

    if (pool.id !== poolOut.id) {
        throw new Error('fromBtcSwap: There is no route')
    }
    const synthIn = symbiosis.getRepresentation(inTokenAmount.token, pool.chainId)
    if (!synthIn) {
        throw new Error('fromBtcSwap: There is no synthIn')
    }
    const tokenAmountIn = new TokenAmount(synthIn, inTokenAmount.raw)

    const synthOut = symbiosis.getRepresentation(outToken, pool.chainId)
    if (!synthOut) {
        throw new Error('fromBtcSwap: There is no synthOut')
    }
    const trade = new OmniTrade(tokenAmountIn, tokenAmountIn, synthOut, slippage, deadline, symbiosis, toAddress, pool)
    await trade.init()

    const multicallRouter = symbiosis.multicallRouter(pool.chainId)

    const data = multicallRouter.interface.encodeFunctionData('multicall', [
        tokenAmountIn.raw.toString(), // amount to be patched
        [trade.callData], // calldatas
        [trade.pool.address], // receiveSides
        [trade.tokenAmountIn.token.address, trade.amountOut.token.address], // paths
        [trade.callDataOffset], // offsets
        symbiosis.metaRouter(pool.chainId).address, // to
    ])

    return {
        address: multicallRouter.address,
        data,
        route: [synthIn, synthOut],
    }
}

interface DepositAddressResult {
    revealAddress: string
    validUntil: string
    legacyAddress: string
}

async function _getDepositAddresses(
    evmReceiverAddress: string,
    feeLimit: string,
    tail: string
): Promise<DepositAddressResult> {
    const minBtcFee = await _getMinBtcFee()

    const raw = JSON.stringify({
        info: {
            to: evmReceiverAddress,
            fee: minBtcFee,
            op: 0, // 0 - is wrap operation
            sbfee: 0, // stable bridging fee for tail execution in satoshi
            tail: btoa(tail), // calldata for next swap from contract SymBtc.FromBTCTransactionTail
        },
        feeLimit,
    })

    const wrapApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
    }

    const response = await fetch(`${wrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const data = await response.json()

    const { revealAddress, validUntil, legacyAddress } = data

    return {
        revealAddress,
        validUntil,
        legacyAddress,
    }
}

async function _getBtcForwarderFee(evmReceiverAddress: string, tail: string): Promise<string> {
    const estimateWrapApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            op: 0, // 0 - wrap operation
            to: evmReceiverAddress,
            tail: btoa(tail),
        },
    })

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
    }

    const response = await fetch(`${estimateWrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const { feeLimit } = await response.json()

    return feeLimit
}

async function _getMinBtcFee(): Promise<string> {
    // kind of the state: 0=finalized 1=pending 2=best
    const portalApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/portal?kind=0`)

    const response = await fetch(portalApiUrl)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const {
        state: { minBtcFee },
    } = await response.json()

    return minBtcFee
}

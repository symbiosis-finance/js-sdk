import { SwapExactInParams, SwapExactInResult } from './types'
import { TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { ChainId } from '../../constants'

export const BTC_FORWARDER_API = {
    testnet: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
    mainnet: 'https://relayers.symbiosis.finance/forwarder/api/v1',
}

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount } = context

    return isBtc(inTokenAmount.token.chainId)
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const {
        evmAccount,
        inTokenAmount,
        outToken,
        symbiosis,
        fromAddress,
        toAddress,
        deadline,
        slippage,
        oneInchProtocols,
    } = context

    if (!evmAccount || (evmAccount && !isAddress(evmAccount))) {
        throw new Error('fromBtcSwap: No EVM address was provided')
    }

    // 1) [TODO]: Fee 2-nd synthesis, 3-rd from advisor in btc
    // 2) tail to next swap on evm

    const sBtc = symbiosis.getRepresentation(inTokenAmount.token, ChainId.SEPOLIA_TESTNET)
    if (!sBtc) {
        throw new Error('fromBtcSwap: No sBtc token found')
    }
    const sBtcTokenAmount = new TokenAmount(sBtc, inTokenAmount.raw)

    // destination of swap is not Bitcoin sBtc
    const isBtcBridging = outToken.equals(sBtc)

    let tail = ''

    if (!isBtcBridging) {
        const bestPoolSwapping = symbiosis.bestPoolSwapping()

        const { transactionRequest } = await bestPoolSwapping.exactIn({
            tokenAmountIn: sBtcTokenAmount,
            tokenOut: outToken,
            from: fromAddress,
            to: toAddress,
            slippage,
            deadline,
            oneInchProtocols,
        })

        const data = (transactionRequest as TransactionRequest).data!

        const result = MetaRouter__factory.createInterface().decodeFunctionResult('metaRoute', data)

        console.log({ result })
        debugger
        const symBtcContract = symbiosis.symBtc(ChainId.SEPOLIA_TESTNET)
        const params = {
            swapTokens: [],
            secondDexRouter: '',
            secondSwapCalldata: '',
            finalReceiveSide: '',
            finalCalldata: [],
            finalOffset: 0,
        }
        const tailHex = await symBtcContract.callStatic.packBTCTransactionTail(params)
        // for compact purpose base-16-->base-64
        tail = Buffer.from(tailHex.slice(2), 'hex').toString('base64')
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
            tail, // calldata for next swap from contract SymBtc.FromBTCTransactionTail
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
            tail,
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

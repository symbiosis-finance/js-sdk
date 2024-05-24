import { SwapExactInParams, SwapExactInResult } from './types'
import { TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { ChainId } from '../../constants'
import { MetaRouteStructs } from '../contracts/MetaRouter'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount } = context

    return isBtc(inTokenAmount.token.chainId)
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken, symbiosis, toAddress } = context

    if (!isAddress(toAddress)) {
        throw new Error('fromBtcSwap: No EVM address was provided')
    }

    const sBtc = symbiosis.getRepresentation(inTokenAmount.token, ChainId.SEPOLIA_TESTNET)
    if (!sBtc) {
        throw new Error('fromBtcSwap: No sBtc token found')
    }

    // destination of swap is not Bitcoin sBtc
    const isBtcBridging = outToken.equals(sBtc)

    let tail: string
    let tokenAmountOut: TokenAmount
    let btcForwarderFee: TokenAmount

    const forwarderUrl = symbiosis.config.btc.forwarderUrl

    const sBtcAmount = new TokenAmount(sBtc, inTokenAmount.raw)
    if (!isBtcBridging) {
        tail = ''
        btcForwarderFee = new TokenAmount(sBtc, await _getBtcForwarderFee(forwarderUrl, toAddress, tail))
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const { tail: tail1 } = await buildTail(context, sBtcAmount.subtract(btcForwarderFee))

        tail = tail1
        btcForwarderFee = new TokenAmount(sBtc, await _getBtcForwarderFee(forwarderUrl, toAddress, tail))
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const { tokenAmountOut: ta, tail: tail2 } = await buildTail(context, sBtcAmount.subtract(btcForwarderFee))

        tail = tail2
        tokenAmountOut = ta
    } else {
        tail = ''
        btcForwarderFee = new TokenAmount(sBtc, await _getBtcForwarderFee(forwarderUrl, toAddress, tail))
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        tokenAmountOut = sBtcAmount.subtract(btcForwarderFee)
    }

    const { validUntil, revealAddress } = await _getDepositAddresses(
        forwarderUrl,
        toAddress,
        btcForwarderFee.raw.toString(),
        tail
    )

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

async function buildTail(
    context: SwapExactInParams,
    tokenAmountIn: TokenAmount
): Promise<{ tokenAmountOut: TokenAmount; tail: string }> {
    const { fromAddress, toAddress, slippage, deadline, oneInchProtocols, outToken, symbiosis } = context
    const bestPoolSwapping = symbiosis.bestPoolSwapping()

    const { transactionRequest, tokenAmountOut } = await bestPoolSwapping.exactIn({
        tokenAmountIn,
        tokenOut: outToken,
        from: fromAddress,
        to: toAddress,
        slippage,
        deadline,
        oneInchProtocols,
    })

    const data = (transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    const symBtcContract = symbiosis.symBtc(ChainId.SEPOLIA_TESTNET) // FIXME chainId hardcoded
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: tx.relayRecipient,
        receiveSideCalldata: tx.otherSideCalldata,
        receiveSideOffset: 100, // metaSynthesize struct
    })

    return {
        tokenAmountOut,
        tail,
    }
}

interface DepositAddressResult {
    revealAddress: string
    validUntil: string
    legacyAddress: string
}

async function _getDepositAddresses(
    forwarderUrl: string,
    evmReceiverAddress: string,
    feeLimit: string,
    tail: string
): Promise<DepositAddressResult> {
    const minBtcFee = await _getMinBtcFee(forwarderUrl)

    const raw = JSON.stringify({
        info: {
            to: evmReceiverAddress,
            fee: minBtcFee,
            op: 0, // 0 - is wrap operation
            sbfee: 0, // stable bridging fee for tail execution in satoshi
            tail: Buffer.from(tail.slice(2), 'hex').toString('base64'), // calldata for next swap from contract SymBtc.FromBTCTransactionTail
        },
        feeLimit: Number(feeLimit), // FIXME
    })

    const wrapApiUrl = new URL(`${forwarderUrl}/wrap`)
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

async function _getBtcForwarderFee(forwarderUrl: string, evmReceiverAddress: string, tail: string): Promise<string> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            op: 0, // 0 - wrap operation
            to: evmReceiverAddress,
            tail: Buffer.from(tail.slice(2), 'hex').toString('base64'),
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

async function _getMinBtcFee(forwarderUrl: string): Promise<string> {
    // kind of the state: 0=finalized 1=pending 2=best
    const portalApiUrl = new URL(`${forwarderUrl}/portal?kind=0`)

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

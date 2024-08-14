import { SwapExactInParams, SwapExactInResult } from './types'
import { Percent, TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { MetaRouteStructs } from '../contracts/MetaRouter'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount } = context

    return isBtc(inTokenAmount.token.chainId)
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken, symbiosis, toAddress } = context

    const btcChainId = inTokenAmount.token.chainId
    const symBtcConfig = symbiosis.symBtcConfigFor(btcChainId)

    const sBtcChainId = symBtcConfig.chainId
    if (!sBtcChainId) {
        throw new Error(`Synthetic BTC chainId wasn't found`)
    }
    const sBtc = symbiosis.getRepresentation(inTokenAmount.token, sBtcChainId)
    if (!sBtc) {
        throw new Error(`Synthetic BTC wasn't found`)
    }

    if (!isAddress(toAddress)) {
        throw new Error(`Destination address wasn't provided`)
    }
    // destination of swap is not Bitcoin sBtc
    const isBtcBridging = outToken.equals(sBtc)

    const forwarderUrl = symbiosis.getForwarderUrl(btcChainId)
    let sBtcAmount = new TokenAmount(sBtc, inTokenAmount.raw)

    const btcFeeRaw = await getBtcFee(forwarderUrl)
    const btcFee = new TokenAmount(sBtc, btcFeeRaw.toString())
    sBtcAmount = sBtcAmount.subtract(btcFee)

    const sbfeeRaw = '1400' // 1400 sat * $70000 = ~$1 // TODO @allush estimate with advisor
    const sbfee = new TokenAmount(sBtc, sbfeeRaw.toString())
    if (sBtcAmount.lessThan(sbfee)) {
        throw new Error(
            `Amount ${sBtcAmount.toSignificant()} ${sBtcAmount.token.symbol} less than fee ${sbfee.toSignificant()} ${
                sbfee.token.symbol
            }`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    sBtcAmount = sBtcAmount.subtract(sbfee)

    let tokenAmountOut: TokenAmount
    let tokenAmountOutMin: TokenAmount
    let save: TokenAmount | undefined
    let priceImpact: Percent | undefined
    let btcForwarderFee: TokenAmount
    let tail: string
    let tailSbFee = new TokenAmount(sBtc, '0')
    if (!isBtcBridging) {
        tail = ''
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcFeeRaw,
                sbfee: sbfeeRaw,
                tail,
                to: toAddress,
            })
        )
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const { tail: tail1 } = await buildTail(context, sBtcAmount.subtract(btcForwarderFee))

        tail = tail1
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcFeeRaw,
                sbfee: sbfeeRaw,
                tail,
                to: toAddress,
            })
        )
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const {
            tokenAmountOut: ta,
            tokenAmountOutMin: taMin,
            tail: tail2,
            fee,
            save: saveFee,
            priceImpact: pi,
        } = await buildTail(context, sBtcAmount.subtract(btcForwarderFee))

        tail = tail2
        tailSbFee = fee
        tokenAmountOut = ta
        tokenAmountOutMin = taMin
        priceImpact = pi
        save = saveFee
    } else {
        tail = ''
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcFeeRaw,
                sbfee: sbfeeRaw,
                tail,
                to: toAddress,
            })
        )
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        tokenAmountOut = sBtcAmount.subtract(btcForwarderFee)
        tokenAmountOutMin = tokenAmountOut
    }

    const { validUntil, revealAddress } = await wrap({
        forwarderUrl,
        portalFee: btcFeeRaw,
        sbfee: sbfeeRaw,
        tail,
        to: toAddress,
        feeLimit: btcForwarderFee.raw.toString(),
    })

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
        tokenAmountOutMin,
        priceImpact,
        approveTo: AddressZero,
        inTradeType: undefined,
        outTradeType: undefined,
        amountInUsd: undefined,
        fee: sbfee.add(new TokenAmount(sbfee.token, tailSbFee.raw)), // FIXME @allush different tokens/decimals
        save,
        extraFee: btcFee.add(btcForwarderFee),
    }
}

async function buildTail(
    context: SwapExactInParams,
    sBtcAmount: TokenAmount
): Promise<{
    tokenAmountOut: TokenAmount
    tokenAmountOutMin: TokenAmount
    priceImpact: Percent
    tail: string
    fee: TokenAmount
    save: TokenAmount
}> {
    const { toAddress, slippage, deadline, oneInchProtocols, outToken, symbiosis } = context
    const bestPoolSwapping = symbiosis.bestPoolSwapping()

    const { transactionRequest, tokenAmountOut, tokenAmountOutMin, fee, save, priceImpact } =
        await bestPoolSwapping.exactIn({
            tokenAmountIn: sBtcAmount,
            tokenOut: outToken,
            from: toAddress, // to be able to revert a tx
            to: toAddress,
            slippage,
            deadline,
            oneInchProtocols,
        })

    const data = (transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    const symBtcContract = symbiosis.symBtcFor(sBtcAmount.token.chainFromId!)
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: tx.relayRecipient,
        receiveSideCalldata: tx.otherSideCalldata,
        receiveSideOffset: 100, // metaSynthesize struct
    })

    return {
        tokenAmountOut,
        tokenAmountOutMin,
        tail,
        fee,
        save,
        priceImpact,
    }
}

interface DepositAddressResult {
    revealAddress: string
    validUntil: string
    legacyAddress: string
}

type EstimateWrapParams = {
    forwarderUrl: string
    portalFee: string
    sbfee: string
    tail: string
    to: string
}

async function estimateWrap({ forwarderUrl, portalFee, sbfee, tail, to }: EstimateWrapParams): Promise<string> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            portalFee,
            op: 0, // 0 - wrap operation
            sbfee: Number(sbfee), // FIXME @nick should accept string,
            tail: encodeTail(tail),
            to,
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

type WrapParams = EstimateWrapParams & {
    feeLimit: string
}
async function wrap({ forwarderUrl, portalFee, sbfee, tail, to, feeLimit }: WrapParams): Promise<DepositAddressResult> {
    const raw = JSON.stringify({
        info: {
            portalFee,
            op: 0, // 0 - is wrap operation
            sbfee: Number(sbfee), // FIXME @nick should accept string
            tail: encodeTail(tail),
            to,
        },
        feeLimit: Number(feeLimit), // FIXME @nick should accept string
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

function encodeTail(tail: string): string {
    return Buffer.from(tail.slice(2), 'hex').toString('base64')
}

async function getBtcFee(forwarderUrl: string): Promise<string> {
    // kind of the state: 0=finalized 1=pending 2=best
    const portalApiUrl = new URL(`${forwarderUrl}/portal?kind=1`)

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

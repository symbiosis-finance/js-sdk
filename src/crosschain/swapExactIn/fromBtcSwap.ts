import { SwapExactInParams, SwapExactInResult } from './types'
import { TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtc, isValidTonAddress } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { parseUnits } from '@ethersproject/units'
import { BaseSwappingExactInResult } from '../baseSwapping'
import { BigNumber } from 'ethers'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount } = context

    return isBtc(inTokenAmount.token.chainId)
}

type BuildTailResult = BaseSwappingExactInResult & { tail: string }

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

    if (!isAddress(toAddress) && !isValidTonAddress(toAddress)) {
        throw new Error(`Destination address wasn't provided`)
    }
    // destination of swap is not Bitcoin sBtc
    const isBtcBridging = outToken.equals(sBtc)

    const forwarderUrl = symbiosis.getForwarderUrl(btcChainId)
    let sBtcAmount = new TokenAmount(sBtc, inTokenAmount.raw)

    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.dataProvider)
    const btcPortalFee = new TokenAmount(sBtc, btcPortalFeeRaw)
    sBtcAmount = sBtcAmount.subtract(btcPortalFee)

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
    let btcForwarderFee: TokenAmount
    let tail: string = ''
    let tailSbFee = new TokenAmount(sBtc, '0')
    let tailResult: BuildTailResult | undefined
    if (!isBtcBridging) {
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
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
                portalFee: btcPortalFeeRaw,
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
        tailResult = await buildTail(context, sBtcAmount.subtract(btcForwarderFee))

        tail = tailResult.tail
        tailSbFee = tailResult.fee
        tokenAmountOut = tailResult.tokenAmountOut
        tokenAmountOutMin = tailResult.tokenAmountOutMin
        btcForwarderFee = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(110).div(100).toString() // +10% of fee
        )
    } else {
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                sbfee: sbfeeRaw,
                tail: '',
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

        const btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(110).div(100).toString() // +10% of fee
        )
        tokenAmountOutMin = sBtcAmount.subtract(btcForwarderFeeMax)
        btcForwarderFee = btcForwarderFeeMax
    }

    const { validUntil, revealAddress } = await wrap({
        forwarderUrl,
        portalFee: btcPortalFeeRaw,
        sbfee: sbfeeRaw,
        tail,
        to: toAddress,
        feeLimit: btcForwarderFee.raw.toString(),
    })

    const parsedValue = parseUnits(tailSbFee.toExact(), sbfee.token.decimals).toString()
    const tailFee = new TokenAmount(sbfee.token, parsedValue)

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut,
        },
        route: [inTokenAmount.token, ...(tailResult ? tailResult.route : [])],
        tokenAmountOut,
        tokenAmountOutMin,
        priceImpact: tailResult?.priceImpact,
        approveTo: AddressZero,
        inTradeType: tailResult?.inTradeType,
        outTradeType: tailResult?.outTradeType,
        amountInUsd: tailResult?.amountInUsd,
        fee: sbfee.add(tailFee),
        save: tailResult && tailResult?.save ? new TokenAmount(sbfee.token, tailResult.save.raw) : undefined,
        extraFee: btcPortalFee.add(btcForwarderFee),
    }
}

async function buildTail(context: SwapExactInParams, sBtcAmount: TokenAmount): Promise<BuildTailResult> {
    const { toAddress, slippage, deadline, oneInchProtocols, outToken, symbiosis } = context
    const bestPoolSwapping = symbiosis.bestPoolSwapping()

    const swapExactInResult = await bestPoolSwapping.exactIn({
        tokenAmountIn: sBtcAmount,
        tokenOut: outToken,
        from: toAddress, // to be able to revert a tx
        to: toAddress,
        slippage,
        deadline,
        oneInchProtocols,
    })

    const data = (swapExactInResult.transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    const symBtcContract = symbiosis.symBtcFor(sBtcAmount.token.chainFromId!)
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: tx.relayRecipient,
        receiveSideCalldata: tx.otherSideCalldata,
        receiveSideOffset: 100, // metaSynthesize struct
    })

    return {
        ...swapExactInResult,
        tail,
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
            portalFee: Number(portalFee),
            op: 0, // 0 - wrap operation
            stableBridgingFee: Number(sbfee),
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
            portalFee: Number(portalFee),
            op: 0, // 0 - is wrap operation
            stableBridgingFee: Number(sbfee),
            tail: encodeTail(tail),
            to,
        },
        feeLimit: Number(feeLimit),
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

async function getBtcPortalFee(forwarderUrl: string, dataProvider: DataProvider): Promise<string> {
    let fee = await dataProvider.get(
        ['getMinBtcFee'],
        async () => {
            // kind of the state: 0=finalized 1=pending 2=best
            const portalApiUrl = new URL(`${forwarderUrl}/portal?kind=2`)

            const response = await fetch(portalApiUrl)
            if (!response.ok) {
                const text = await response.text()
                const json = JSON.parse(text)
                throw new Error(json.message ?? text)
            }

            const {
                state: { minBtcFee },
            } = await response.json()

            return Number(minBtcFee)
        },
        600 // 10 minutes
    )

    try {
        const recommendedFee: number = await dataProvider.get(
            ['getFastestFee'],
            async () => {
                const fastestFee = await getFastestFee()
                return fastestFee * 200
            },
            60 // 1 minute
        )
        if (recommendedFee > fee) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }
    return fee.toString()
}

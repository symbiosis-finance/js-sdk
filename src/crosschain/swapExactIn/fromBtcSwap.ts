import { SwapExactInParams, SwapExactInResult } from './types'
import { Percent, Token, TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { parseUnits } from '@ethersproject/units'
import { BaseSwappingExactInResult } from '../baseSwapping'
import { BigNumber } from 'ethers'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'
import { AggregatorTrade, SymbiosisTradeType } from '../trade'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount, symbiosis } = context

    if (!isBtc(inTokenAmount.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(inTokenAmount)

    return true
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

    if (!isAddress(toAddress)) {
        throw new Error(`Destination address wasn't provided`)
    }

    const forwarderUrl = symbiosis.getForwarderUrl(btcChainId)
    let sBtcAmount = new TokenAmount(sBtc, inTokenAmount.raw)

    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.dataProvider)
    const btcPortalFee = new TokenAmount(sBtc, btcPortalFeeRaw)
    sBtcAmount = sBtcAmount.subtract(btcPortalFee)

    const mintFeeRaw = '1000' // satoshi
    const mintFee = new TokenAmount(sBtc, mintFeeRaw.toString())
    if (sBtcAmount.lessThan(mintFee)) {
        throw new Error(
            `Amount ${sBtcAmount.toSignificant()} ${sBtcAmount.token.symbol} less than fee ${mintFee.toSignificant()} ${
                mintFee.token.symbol
            }`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    sBtcAmount = sBtcAmount.subtract(mintFee)

    let tokenAmountOut: TokenAmount
    let tokenAmountOutMin: TokenAmount
    let btcForwarderFee: TokenAmount
    let btcForwarderFeeMax: TokenAmount
    let tail: string
    let tailFee = new TokenAmount(sBtc, '0')
    let priceImpact: Percent | undefined
    let inTradeType: SymbiosisTradeType | undefined
    let outTradeType: SymbiosisTradeType | undefined
    let amountInUsd: TokenAmount | undefined
    let route: Token[] = []
    let save: TokenAmount | undefined

    if (outToken.equals(sBtc)) {
        // bridging BTC -> syBTC
        tail = ''
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
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

        btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(120).div(100).toString() // +20% of fee
        )
        tokenAmountOutMin = sBtcAmount.subtract(btcForwarderFeeMax)
    } else {
        const sameChain = outToken.chainId === sBtc.chainId
        const buildTailFunc = sameChain ? buildOnchainTail : buildTail

        const { tail: initialTail } = await buildTailFunc(context, sBtcAmount)
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail: initialTail,
                to: toAddress,
            })
        )
        btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(120).div(100).toString() // +20% of fee
        )
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const tailResult = await buildTailFunc(context, sBtcAmount.subtract(btcForwarderFee))
        tail = tailResult.tail
        tailFee = tailResult.fee
        tokenAmountOut = tailResult.tokenAmountOut
        tokenAmountOutMin = tailResult.tokenAmountOutMin
        priceImpact = tailResult.priceImpact
        inTradeType = tailResult.inTradeType
        outTradeType = tailResult.outTradeType
        amountInUsd = tailResult.amountInUsd
        route = tailResult.route
        if (tailResult.save) {
            save = new TokenAmount(mintFee.token, tailResult.save.raw)
        }
    }

    const { validUntil, revealAddress } = await wrap({
        forwarderUrl,
        portalFee: btcPortalFeeRaw,
        stableBridgingFee: mintFeeRaw,
        tail,
        to: toAddress,
        feeLimit: btcForwarderFeeMax.raw.toString(),
    })

    const parsedValue = parseUnits(tailFee.toExact(), mintFee.token.decimals).toString()
    const tailFeeInMintToken = new TokenAmount(mintFee.token, parsedValue)

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut,
        },
        route: [inTokenAmount.token, ...route],
        tokenAmountOut,
        tokenAmountOutMin,
        priceImpact,
        approveTo: AddressZero,
        inTradeType,
        outTradeType,
        amountInUsd,
        fee: mintFee.add(tailFeeInMintToken),
        save,
        extraFee: btcPortalFee.add(btcForwarderFee),
    }
}

async function buildOnchainTail(context: SwapExactInParams, sBtcAmount: TokenAmount): Promise<BuildTailResult> {
    const { toAddress, outToken, symbiosis, slippage, oneInchProtocols } = context
    const ttl = context.deadline - Math.floor(Date.now() / 1000)
    const aggregatorTrade = new AggregatorTrade({
        symbiosis,
        to: toAddress,
        from: toAddress, // there is not from address, set user's address
        clientId: symbiosis.clientId,
        dataProvider: symbiosis.dataProvider,
        slippage,
        tokenAmountIn: sBtcAmount,
        tokenOut: outToken,
        ttl,
        oneInchProtocols,
    })
    await aggregatorTrade.init()

    const symBtcContract = symbiosis.symBtcFor(sBtcAmount.token.chainFromId!)
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: aggregatorTrade.routerAddress,
        receiveSideCalldata: aggregatorTrade.callData,
        receiveSideOffset: aggregatorTrade.callDataOffset,
    })

    const { amountOut, amountOutMin, callData, priceImpact, routerAddress } = aggregatorTrade

    return {
        type: 'evm',
        transactionRequest: {
            chainId: sBtcAmount.token.chainId,
            from: toAddress, // there is not from address, set user's address
            to: toAddress,
            value: '0',
            data: callData,
        },
        save: new TokenAmount(sBtcAmount.token, '0'),
        fee: new TokenAmount(sBtcAmount.token, '0'),
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOutMin,
        route: [sBtcAmount.token],
        priceImpact,
        amountInUsd: sBtcAmount,
        approveTo: routerAddress,
        tail,
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
    stableBridgingFee: string
    tail: string
    to: string
}

async function estimateWrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
}: EstimateWrapParams): Promise<string> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - wrap operation
            stableBridgingFee: Number(stableBridgingFee),
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

    const { revealTxFee } = await response.json()

    return revealTxFee
}

type WrapParams = EstimateWrapParams & {
    feeLimit: string
}
async function wrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    feeLimit,
}: WrapParams): Promise<DepositAddressResult> {
    const raw = JSON.stringify({
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - is wrap operation
            stableBridgingFee: Number(stableBridgingFee),
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

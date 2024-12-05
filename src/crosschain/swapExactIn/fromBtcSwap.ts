import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../types'
import { Percent, TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtcChainId } from '../chainUtils'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { BigNumber } from 'ethers'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'
import { AggregatorTrade } from '../trade'
import { bestTokenSwapping } from './crosschainSwap/bestTokenSwapping'
import { BIPS_BASE } from '../constants'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, symbiosis } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(tokenAmountIn)

    return true
}

type BuildTailResult = SwapExactInResult & { tail: string }

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to } = context

    const btcChainId = tokenAmountIn.token.chainId
    const symBtcConfig = symbiosis.symBtcConfigFor(btcChainId)

    const syBtcChainId = symBtcConfig.chainId
    if (!syBtcChainId) {
        throw new Error(`syBTC chainId wasn't found`)
    }
    const syBtcSynth = symbiosis.getRepresentation(tokenAmountIn.token, syBtcChainId)
    if (!syBtcSynth) {
        throw new Error(`syBTC as synth wasn't found`)
    }
    const syBtc = symbiosis.tokens().find((token) => token.equals(syBtcSynth) && !token.isSynthetic)
    if (!syBtc) {
        throw new Error(`syBTC as original wasn't found`)
    }

    if (!isAddress(to)) {
        throw new Error(`Destination address wasn't provided`)
    }

    const forwarderUrl = symbiosis.getForwarderUrl(btcChainId)
    const btcAmountRaw = tokenAmountIn.raw.toString()
    let syBtcAmount = new TokenAmount(syBtc, btcAmountRaw)

    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.dataProvider)
    const btcPortalFee = new TokenAmount(syBtc, btcPortalFeeRaw)
    syBtcAmount = syBtcAmount.subtract(btcPortalFee)

    const mintFeeRaw = '1000' // satoshi
    const mintFee = new TokenAmount(syBtc, mintFeeRaw.toString())
    if (syBtcAmount.lessThan(mintFee)) {
        throw new Error(
            `Amount ${syBtcAmount.toSignificant()} ${
                syBtcAmount.token.symbol
            } less than fee ${mintFee.toSignificant()} ${mintFee.token.symbol}`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    syBtcAmount = syBtcAmount.subtract(mintFee)

    let tokenAmountOut: TokenAmount
    let tokenAmountOutMin: TokenAmount
    let btcForwarderFee: TokenAmount
    let btcForwarderFeeMax: TokenAmount
    let tail: string
    let tailFees: FeeItem[] = []
    let priceImpact: Percent = new Percent('0', BIPS_BASE)
    let amountInUsd: TokenAmount | undefined
    let routes: RouteItem[] = []

    if (tokenOut.equals(syBtc)) {
        // bridging BTC -> syBTC
        tail = ''
        btcForwarderFee = new TokenAmount(
            syBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail,
                to,
                amount: btcAmountRaw,
            })
        )
        if (btcForwarderFee.greaterThan(syBtcAmount)) {
            throw new Error(
                `Amount ${syBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        tokenAmountOut = syBtcAmount.subtract(btcForwarderFee)

        btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(200).div(100).toString() // +100% of fee
        )
        tokenAmountOutMin = syBtcAmount.subtract(btcForwarderFeeMax)
    } else {
        // const sameChain = tokenOut.chainId === syBtc.chainId
        const sameChain = false
        const buildTailFunc = sameChain ? buildOnchainTail : buildTail

        const { tail: initialTail } = await buildTailFunc(context, syBtcAmount)
        btcForwarderFee = new TokenAmount(
            syBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail: initialTail,
                to,
                amount: btcAmountRaw,
            })
        )
        btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(200).div(100).toString() // +100% of fee
        )
        if (btcForwarderFee.greaterThan(syBtcAmount)) {
            throw new Error(
                `Amount ${syBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const tailResult = await buildTailFunc(context, syBtcAmount.subtract(btcForwarderFee))
        tail = tailResult.tail
        tailFees = tailResult.fees
        tokenAmountOut = tailResult.tokenAmountOut
        tokenAmountOutMin = tailResult.tokenAmountOutMin
        priceImpact = tailResult.priceImpact
        amountInUsd = tailResult.amountInUsd
        routes = tailResult.routes
    }

    const { validUntil, revealAddress } = await wrap({
        forwarderUrl,
        portalFee: btcPortalFeeRaw,
        stableBridgingFee: mintFeeRaw,
        tail,
        to,
        feeLimit: btcForwarderFeeMax.raw.toString(),
        amount: btcAmountRaw,
    })

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut,
        },
        tokenAmountOut,
        tokenAmountOutMin,
        priceImpact,
        approveTo: AddressZero,
        amountInUsd,
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, syBtc],
            },
            ...routes,
        ],
        fees: [
            {
                provider: 'symbiosis',
                description: 'BTC Forwarder fee',
                value: new TokenAmount(tokenAmountIn.token, btcForwarderFee.raw),
            },
            {
                provider: 'symbiosis',
                description: 'BTC Portal fee',
                value: new TokenAmount(tokenAmountIn.token, btcPortalFee.raw),
            },
            {
                provider: 'symbiosis',
                description: 'Mint fee',
                value: mintFee,
            },
            ...tailFees,
        ],
    }
}

async function buildOnchainTail(context: SwapExactInParams, sBtcAmount: TokenAmount): Promise<BuildTailResult> {
    const { tokenAmountIn, to, tokenOut, deadline, symbiosis } = context
    const aggregatorTrade = new AggregatorTrade({
        ...context,
        from: to, // there is not from address, set user's address
        clientId: symbiosis.clientId,
        dataProvider: symbiosis.dataProvider,
        tokenAmountIn: sBtcAmount,
        deadline,
    })
    await aggregatorTrade.init()

    const symBtcContract = symbiosis.symBtcFor(tokenAmountIn.token.chainId)
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: aggregatorTrade.routerAddress,
        receiveSideCalldata: aggregatorTrade.callData,
        receiveSideOffset: aggregatorTrade.callDataOffset,
    })

    const { amountOut, amountOutMin, callData, priceImpact, routerAddress } = aggregatorTrade

    const payload: SwapExactInTransactionPayload = {
        transactionType: 'evm',
        transactionRequest: {
            chainId: sBtcAmount.token.chainId,
            from: to, // there is not from address, set user's address
            to,
            value: '0',
            data: callData,
        },
    }
    return {
        ...payload,
        kind: 'onchain-swap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOutMin,
        priceImpact,
        amountInUsd: sBtcAmount,
        approveTo: routerAddress,
        routes: [
            {
                provider: aggregatorTrade.tradeType,
                tokens: [sBtcAmount.token, tokenOut],
            },
        ],
        fees: [],
        tail,
    }
}

async function buildTail(context: SwapExactInParams, sBtcAmount: TokenAmount): Promise<BuildTailResult> {
    const { tokenAmountIn, to, symbiosis } = context

    const poolConfig = symbiosis.config.omniPools[2] // btc pool only
    const swapExactInResult = await bestTokenSwapping(
        {
            ...context,
            tokenAmountIn: sBtcAmount,
            from: to, // to be able to revert a tx
        },
        poolConfig
    )

    // const swapExactInResult = await bestPoolSwapping({
    //     ...context,
    //     tokenAmountIn: sBtcAmount,
    //     from: to, // to be able to revert a tx
    // })

    const data = (swapExactInResult.transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    const symBtcContract = symbiosis.symBtcFor(tokenAmountIn.token.chainId)
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
    amount: string
}

async function estimateWrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    amount,
}: EstimateWrapParams): Promise<string> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        amount: Number(amount),
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
    amount,
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
        amount: Number(amount),
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
        const fastestFee = await dataProvider.get(['getFastestFee'], getFastestFee, 60) // 1 minute
        const recommendedFee = fastestFee * 200 // 200 vByte
        if (recommendedFee > fee) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }
    return fee.toString()
}

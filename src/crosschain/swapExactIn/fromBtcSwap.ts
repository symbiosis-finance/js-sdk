import { TransactionRequest } from '@ethersproject/providers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { BigNumber } from 'ethers'
import { isAddress } from 'ethers/lib/utils'

import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../types'
import { Percent, TokenAmount } from '../../entities'

import { Error, ErrorCode } from '../error'
import { isBtcChainId, isEvmChainId, isTronChainId } from '../chainUtils'
import { MetaRouter__factory, SymBtc, SymBtc__factory } from '../contracts'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { Cache } from '../cache'
import { getFastestFee } from '../mempool'
import { AggregatorTrade } from '../trade'
import { BIPS_BASE } from '../constants'
import { BTC_CONFIGS, BtcConfig } from '../chainUtils/btc'
import { theBest } from './utils'
import { ChainId } from '../../constants'
import { bestPoolSwapping } from './crosschainSwap/bestPoolSwapping'

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
    const { tokenAmountIn, selectMode, refundAddress } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        throw new Error(`tokenAmountIn is not BTC token`)
    }

    if (!refundAddress) {
        throw new Error(`Refund address is required`)
    }

    const promises: Promise<SwapExactInResult>[] = []

    // configs except syBTC on zksync
    const configs = BTC_CONFIGS.filter((i) => i.symBtc.chainId !== ChainId.ZKSYNC_MAINNET)
    configs.forEach((btConfig) => {
        promises.push(fromBtcSwapInternal(context, btConfig))
    })

    return theBest(promises, selectMode)
}

async function fromBtcSwapInternal(context: SwapExactInParams, btcConfig: BtcConfig): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to, refundAddress } = context

    if (!refundAddress) {
        throw new Error(`Refund address is required`)
    }

    const { btc, symBtc, forwarderUrl } = btcConfig

    const syBtcSynth = symbiosis.getRepresentation(btc, symBtc.chainId)
    if (!syBtcSynth) {
        throw new Error(`syBTC as synth wasn't found`)
    }
    const syBtc = symbiosis.tokens().find((token) => token.equals(syBtcSynth) && !token.isSynthetic)
    if (!syBtc) {
        throw new Error(`syBTC as original wasn't found`)
    }

    if (!isEvmChainId(tokenOut.chainId) && !isTronChainId(tokenOut.chainId)) {
        throw new Error(`Only EVM chains are allowed to swap from BTC`)
    }

    if (!isAddress(to)) {
        throw new Error(`Incorrect destination address was provided`)
    }

    const btcAmountRaw = tokenAmountIn.raw.toString()
    let syBtcAmount = new TokenAmount(syBtc, btcAmountRaw)

    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.cache)
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
                refundAddress,
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
        const sameChain = tokenOut.chainId === syBtc.chainId

        const symBtcContract = SymBtc__factory.connect(symBtc.address, symbiosis.getProvider(symBtc.chainId))

        const buildTailFunc = sameChain ? buildOnchainTail : buildTail

        const { tail: initialTail } = await buildTailFunc(context, syBtcAmount, symBtcContract)
        btcForwarderFee = new TokenAmount(
            syBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail: initialTail,
                to,
                amount: btcAmountRaw,
                refundAddress,
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
        const tailResult = await buildTailFunc(context, syBtcAmount.subtract(btcForwarderFee), symBtcContract)
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
        refundAddress,
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
                tokens: [btc, syBtc],
            },
            ...routes,
        ],
        fees: [
            {
                provider: 'symbiosis',
                description: 'BTC Forwarder fee',
                value: new TokenAmount(btc, btcForwarderFee.raw),
            },
            {
                provider: 'symbiosis',
                description: 'BTC Portal fee',
                value: new TokenAmount(btc, btcPortalFee.raw),
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

async function buildOnchainTail(
    context: SwapExactInParams,
    syBtcAmount: TokenAmount,
    symBtcContract: SymBtc
): Promise<BuildTailResult> {
    const { to, tokenOut, deadline, symbiosis } = context
    const aggregatorTrade = new AggregatorTrade({
        ...context,
        from: to, // there is not from address, set user's address
        clientId: symbiosis.clientId,
        tokenAmountIn: syBtcAmount,
        deadline,
    })
    await aggregatorTrade.init()

    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: aggregatorTrade.routerAddress,
        receiveSideCalldata: aggregatorTrade.callData,
        receiveSideOffset: aggregatorTrade.callDataOffset,
    })

    const { amountOut, amountOutMin, callData, priceImpact, routerAddress } = aggregatorTrade

    const payload: SwapExactInTransactionPayload = {
        transactionType: 'evm',
        transactionRequest: {
            chainId: syBtcAmount.token.chainId,
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
        amountInUsd: syBtcAmount,
        approveTo: routerAddress,
        routes: [
            {
                provider: aggregatorTrade.tradeType,
                tokens: [syBtcAmount.token, tokenOut],
            },
        ],
        fees: [],
        tail,
    }
}

async function buildTail(
    context: SwapExactInParams,
    syBtcAmount: TokenAmount,
    symBtcContract: SymBtc
): Promise<BuildTailResult> {
    const { to, symbiosis } = context

    const swapExactInResult = await bestPoolSwapping({
        ...context,
        tokenAmountIn: syBtcAmount,
        from: to, // to be able to revert a tx
        tradeAContext: 'multicallRouter',
    })

    const data = (swapExactInResult.transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    let tail = ''
    if (swapExactInResult.tradeA) {
        const callDatas = [tx.firstSwapCalldata, tx.otherSideCalldata]
        const receiveSides = [tx.firstDexRouter, tx.relayRecipient]
        const path = [...tx.approvedTokens]
        const offsets = [swapExactInResult.tradeA.callDataOffset, 100] // metaSynthesize struct offset

        const chainId = syBtcAmount.token.chainId
        const multicallRouter = symbiosis.multicallRouter(chainId)

        const multicallRouterData = multicallRouter.interface.encodeFunctionData('multicall', [
            syBtcAmount.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            to,
        ])

        tail = await symBtcContract.callStatic.packBTCTransactionTail({
            receiveSide: multicallRouter.address,
            receiveSideCalldata: multicallRouterData,
            receiveSideOffset: 36,
        })
    } else {
        tail = await symBtcContract.callStatic.packBTCTransactionTail({
            receiveSide: tx.relayRecipient,
            receiveSideCalldata: tx.otherSideCalldata,
            receiveSideOffset: 100, // metaSynthesize struct
        })
    }

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
    refundAddress: string
}

async function estimateWrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    amount,
    refundAddress,
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
        refundAddress,
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
    refundAddress: string
}

async function wrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    feeLimit,
    amount,
    refundAddress,
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
        refundAddress,
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

async function getBtcPortalFee(forwarderUrl: string, cache: Cache): Promise<string> {
    let fee = await cache.get(
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
        const fastestFee = await cache.get(['getFastestFee'], getFastestFee, 60) // 1 minute
        const recommendedFee = fastestFee * 200 // 200 vByte
        if (recommendedFee > fee) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }
    return fee.toString()
}

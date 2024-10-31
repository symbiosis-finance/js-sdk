import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../types'
import { Percent, TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error, ErrorCode } from '../error'
import { isBtcChainId } from '../chainUtils/btc'
import { isAddress } from 'ethers/lib/utils'
import { MetaRouter__factory } from '../contracts'
import { TransactionRequest } from '@ethersproject/providers'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { BigNumber } from 'ethers'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'
import { AggregatorTrade } from '../trade'
import { bestTokenSwapping } from './crosschainSwap/bestTokenSwapping'

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

    const sBtcChainId = symBtcConfig.chainId
    if (!sBtcChainId) {
        throw new Error(`Synthetic BTC chainId wasn't found`)
    }
    const sBtc = symbiosis.getRepresentation(tokenAmountIn.token, sBtcChainId)
    if (!sBtc) {
        throw new Error(`Synthetic BTC wasn't found`)
    }

    if (!isAddress(to)) {
        throw new Error(`Destination address wasn't provided`)
    }

    const forwarderUrl = symbiosis.getForwarderUrl(btcChainId)
    let sBtcAmount = new TokenAmount(sBtc, tokenAmountIn.raw)

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
    let tailFees: FeeItem[] = []
    let priceImpact: Percent = new Percent('0', '0')
    let amountInUsd: TokenAmount | undefined
    let routes: RouteItem[] = []

    if (tokenOut.equals(sBtc)) {
        // bridging BTC -> syBTC
        tail = ''
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail,
                to,
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
            BigNumber.from(btcForwarderFee.raw.toString()).mul(200).div(100).toString() // +100% of fee
        )
        tokenAmountOutMin = sBtcAmount.subtract(btcForwarderFeeMax)
    } else {
        const sameChain = tokenOut.chainId === sBtc.chainId
        const buildTailFunc = sameChain ? buildOnchainTail : buildTail

        const { tail: initialTail } = await buildTailFunc(context, sBtcAmount)
        btcForwarderFee = new TokenAmount(
            sBtc,
            await estimateWrap({
                forwarderUrl,
                portalFee: btcPortalFeeRaw,
                stableBridgingFee: mintFeeRaw,
                tail: initialTail,
                to,
            })
        )
        btcForwarderFeeMax = new TokenAmount(
            btcForwarderFee.token,
            BigNumber.from(btcForwarderFee.raw.toString()).mul(200).div(100).toString() // +100% of fee
        )
        if (btcForwarderFee.greaterThan(sBtcAmount)) {
            throw new Error(
                `Amount ${sBtcAmount.toSignificant()} less than btcForwarderFee ${btcForwarderFee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const tailResult = await buildTailFunc(context, sBtcAmount.subtract(btcForwarderFee))
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
                tokens: [tokenAmountIn.token, sBtc],
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
    const { to, tokenOut, deadline, symbiosis } = context
    const ttl = deadline - Math.floor(Date.now() / 1000)
    const aggregatorTrade = new AggregatorTrade({
        ...context,
        from: to, // there is not from address, set user's address
        clientId: symbiosis.clientId,
        dataProvider: symbiosis.dataProvider,
        tokenAmountIn: sBtcAmount,
        ttl,
    })
    await aggregatorTrade.init()

    const symBtcContract = symbiosis.symBtcFor(sBtcAmount.token.chainFromId!)
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
    const { to, symbiosis } = context

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

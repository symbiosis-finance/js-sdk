import { AddressZero } from '@ethersproject/constants/lib/addresses'
import type { TransactionRequest } from '@ethersproject/providers'
import { validate as validateBitcoinAddress } from 'bitcoin-address-validation'
import { BigNumber } from 'ethers'
import type { BytesLike } from 'ethers/lib/utils'
import { isAddress } from 'ethers/lib/utils'

import Decimal from 'decimal.js-light'
import { ChainId } from '../../constants'
import type { Token } from '../../entities'
import { Percent, TokenAmount } from '../../entities'
import { getBtcPortalFee, getPkScript, isBtcChainId, isEvmChainId, isTronChainId } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { MetaRouter__factory, SymBtc__factory } from '../contracts'
import type { MetaRouteStructs } from '../contracts/MetaRouter'
import type { DepositoryContext, DepositParams, Prices } from '../depository'
import { amountsToPrices } from '../depository'
import { getPartnerFeeCall } from '../feeCall/getPartnerFeeCall'
import { getVolumeFeeCall } from '../feeCall/getVolumeFeeCall'
import { AmountLessThanFeeError, SdkError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import { AggregatorTrade } from '../trade'
import { DepositoryTrade } from '../trade/depositoryTrade'
import type { SymbiosisTrade, SymbiosisTradeParams } from '../trade/symbiosisTrade'
import type {
    BtcAddress,
    BtcConfig,
    EmptyAddress,
    EvmAddress,
    FeeItem,
    MultiCallItem,
    NonEmptyAddress,
    PriceEstimationConfig,
    RouteItem,
    SwapExactInParams,
    SwapExactInResult,
} from '../types'
import { isUseOneInchOnly } from '../utils'
import { crosschainSwap } from './crosschainSwap'
import { theBest } from './utils'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, symbiosis } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(tokenAmountIn)

    return true
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, selectMode, symbiosis } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        throw new SdkError(`tokenAmountIn is not BTC token`)
    }

    const promises: Promise<SwapExactInResult>[] = []

    // configs except syBTC on zksync
    const allConfigs = symbiosis.config.btcConfigs.filter((i) => i.symBtc.chainId !== ChainId.ZKSYNC_MAINNET)
    // prefer to use destination chain syBTC to avoid cross-chain routing
    const chainOutConfigs = allConfigs.filter((i) => i.symBtc.chainId === tokenOut.chainId)
    const configs = chainOutConfigs.length > 0 ? chainOutConfigs : allConfigs
    configs.forEach((btcConfig) => {
        promises.push(
            (async () => {
                try {
                    return await fromBtcSwapInternal(context, btcConfig)
                } catch (err) {
                    console.log(err)
                    throw err
                }
            })()
        )
    })

    return theBest(promises, selectMode)
}

async function fromBtcSwapInternal(context: SwapExactInParams, btcConfig: BtcConfig): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to, refundAddress, generateBtcDepositAddress } = context

    const { btc, symBtc, forwarderUrl } = btcConfig

    const syBtcSynth = symbiosis.getRepresentation(btc, symBtc.chainId)
    if (!syBtcSynth) {
        throw new SdkError(`syBTC as synth wasn't found`)
    }
    const syBtc = symbiosis.tokens().find((token) => token.equals(syBtcSynth) && !token.isSynthetic)
    if (!syBtc) {
        throw new SdkError(`syBTC as original wasn't found`)
    }

    if (!isEvmChainId(tokenOut.chainId) && !isTronChainId(tokenOut.chainId)) {
        throw new SdkError(`Only EVM chains are allowed to swap from BTC`)
    }

    if (!isAddress(to)) {
        throw new SdkError(`Incorrect destination address was provided`)
    }

    if (refundAddress && !validateBitcoinAddress(refundAddress)) {
        throw new SdkError(`Incorrect refund address was provided`)
    }

    const btcAmountRaw = tokenAmountIn.raw.toString()
    let syBtcAmount = new TokenAmount(syBtc, btcAmountRaw)

    const fees: FeeItem[] = []

    // >> PORTAL FEE
    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.cache)
    const btcPortalFee = new TokenAmount(syBtc, btcPortalFeeRaw)
    if (syBtcAmount.lessThan(btcPortalFee)) {
        throw new AmountLessThanFeeError(
            `Amount ${syBtcAmount.toSignificant()} ${
                syBtcAmount.token.symbol
            } less than btcPortalFee ${btcPortalFee.toSignificant()} ${btcPortalFee.token.symbol}`
        )
    }
    syBtcAmount = syBtcAmount.subtract(btcPortalFee)
    fees.push({
        provider: 'symbiosis',
        description: 'BTC Portal fee',
        value: new TokenAmount(btc, btcPortalFee.raw),
    })

    // >> MINT FEE
    const mintFeeRaw = '1000' // satoshi
    const mintFee = new TokenAmount(syBtc, mintFeeRaw.toString())
    if (syBtcAmount.lessThan(mintFee)) {
        throw new AmountLessThanFeeError(
            `Amount ${syBtcAmount.toSignificant()} ${
                syBtcAmount.token.symbol
            } less than mintFee ${mintFee.toSignificant()} ${mintFee.token.symbol}`
        )
    }
    syBtcAmount = syBtcAmount.subtract(mintFee)
    fees.push({
        provider: 'symbiosis',
        description: 'Mint fee',
        value: mintFee,
    })
    let syBtcAmountMin = syBtcAmount

    const { tail: initialTail } = await buildTail(context, btcConfig, syBtcAmount, syBtcAmountMin)

    const btcForwarderFeeRaw = await estimateWrap({
        forwarderUrl,
        portalFee: btcPortalFeeRaw,
        stableBridgingFee: mintFeeRaw,
        tail: initialTail,
        to: to as EvmAddress,
        amount: btcAmountRaw,
        refundAddress: refundAddress as BtcAddress,
        clientId: symbiosis.clientId,
    })
    const btcForwarderFee = new TokenAmount(syBtc, btcForwarderFeeRaw.toString())
    const btcForwarderFeeMax = btcForwarderFee.add(btcForwarderFee) // +100% of fee
    if (syBtcAmount.lessThan(btcForwarderFeeMax)) {
        throw new AmountLessThanFeeError(
            `Amount ${syBtcAmount.toSignificant()} less than btcForwarderFeeMax ${btcForwarderFeeMax.toSignificant()}`
        )
    }
    syBtcAmount = syBtcAmount.subtract(btcForwarderFee)
    syBtcAmountMin = syBtcAmount.subtract(btcForwarderFee)
    fees.push({
        provider: 'symbiosis',
        description: 'BTC Forwarder fee',
        value: new TokenAmount(btc, btcForwarderFeeMax.raw),
    })

    // >> TODO patch amounts instead calling quote again
    const {
        tail,
        fees: swapFees,
        tokenAmountOut,
        tokenAmountOutMin,
        priceImpact,
        routes,
        tradeA,
        tradeC,
    } = await buildTail(context, btcConfig, syBtcAmount, syBtcAmountMin)
    fees.push(...swapFees)
    // <<

    let validUntil = ''
    let revealAddress = ''
    if (generateBtcDepositAddress) {
        const wrapResponse = await wrap({
            forwarderUrl,
            portalFee: btcPortalFeeRaw,
            stableBridgingFee: mintFeeRaw,
            tail,
            to: to as EvmAddress,
            feeLimit: btcForwarderFeeMax.raw.toString(),
            amount: btcAmountRaw,
            refundAddress: refundAddress as BtcAddress,
            clientId: symbiosis.clientId,
        })
        validUntil = wrapResponse.validUntil
        revealAddress = wrapResponse.revealAddress
    }

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
        amountInUsd: tokenAmountOut,
        routes: [
            {
                provider: 'symbiosis',
                tokens: [btc, syBtc],
            },
            ...routes,
        ],
        fees,
        tradeA,
        tradeC,
    }
}

async function buildTail(
    context: SwapExactInParams,
    btcConfig: BtcConfig,
    syBtcAmount: TokenAmount,
    syBtcAmountMin: TokenAmount
): Promise<{
    tail: string
    fees: FeeItem[]
    routes: RouteItem[]
    priceImpact: Percent
    tokenAmountOut: TokenAmount
    tokenAmountOutMin: TokenAmount
    tradeA?: SymbiosisTrade
    tradeC?: SymbiosisTrade
}> {
    const { symbiosis, partnerAddress, to, tokenOut } = context

    const { symBtc } = btcConfig
    const chainId = syBtcAmount.token.chainId

    const calls: MultiCallItem[] = []
    const fees: FeeItem[] = []
    const routes: RouteItem[] = []

    const partnerFeeCall = await getPartnerFeeCall({
        symbiosis,
        amountIn: syBtcAmount,
        partnerAddress,
    })
    if (partnerFeeCall) {
        syBtcAmount = partnerFeeCall.amountOut // override
        calls.push(partnerFeeCall)
        fees.push(...partnerFeeCall.fees)
    }

    const feeCollector = symbiosis.getVolumeFeeCollector(syBtcAmount.token.chainId, [ChainId.BTC_MAINNET])
    if (feeCollector) {
        const volumeFeeCall = getVolumeFeeCall({
            feeCollector,
            amountIn: syBtcAmount,
        })
        syBtcAmount = volumeFeeCall.amountOut // override
        calls.push(volumeFeeCall)
        fees.push(...volumeFeeCall.fees)
    }

    const isOnChain = tokenOut.chainId === chainId
    const buildSwapFunc = isOnChain ? buildOnChainSwap : buildCrossChainSwap

    const swapResult = await buildSwapFunc(context, btcConfig, syBtcAmount, syBtcAmountMin)
    let tokenAmountOut: TokenAmount
    let tokenAmountOutMin: TokenAmount
    let priceImpact: Percent

    if (swapResult.calls) {
        calls.push(...swapResult.calls)
    }
    const res = swapResult.result
    const tradeA = swapResult.tradeA
    if (res) {
        // Crosschain case.
        fees.push(...(res.fees || []))
        routes.push(...res.routes)
        tokenAmountOut = res.tokenAmountOut
        tokenAmountOutMin = res.tokenAmountOutMin
        priceImpact = res.priceImpact
    } else if (tradeA) {
        // Onchain case wit swap.
        fees.push(...(tradeA.fees || []))
        routes.push({ provider: 'depository', tokens: tradeA.route }) // TODO: pass provider from tail call.
        tokenAmountOut = tradeA.amountOut
        tokenAmountOutMin = tradeA.amountOut
        priceImpact = tradeA.priceImpact
    } else {
        // Onchain case with syBTC target.
        tokenAmountOut = syBtcAmount
        tokenAmountOutMin = syBtcAmountMin
        priceImpact = new Percent('0', BIPS_BASE)
    }

    const multicallRouter = symbiosis.multicallRouter(chainId)
    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        '0', // will be patched
        [...calls.map((i) => i.data)],
        [...calls.map((i) => i.to)],
        [...calls.map((i) => (i.amountIn.token.isNative ? AddressZero : i.amountIn.token.address))],
        [...calls.map((i) => i.offset)],
        to,
    ])
    const symBtcContract = SymBtc__factory.connect(symBtc.address, symbiosis.getProvider(chainId))
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: multicallRouter.address,
        receiveSideCalldata: multicallCalldata,
        receiveSideOffset: 36,
    })

    return {
        tail,
        fees,
        routes,
        priceImpact,
        tokenAmountOut,
        tokenAmountOutMin,
        tradeA: tradeA || res?.tradeA,
        tradeC: res?.tradeC,
    }
}

type SwapResult = {
    calls: MultiCallItem[]
    result?: SwapExactInResult
    tradeA?: SymbiosisTrade
}

type SwapResultCrossChain = SwapResult & {
    result: SwapExactInResult
}

async function getCoingeckoPrice(tokenIn: Token, tokenOut: Token, symbiosis: Symbiosis): Promise<Decimal> {
    const coinGecko = symbiosis.coinGecko
    const [inPrice, outPrice] = await Promise.all([
        coinGecko.getTokenPriceCached(tokenIn),
        coinGecko.getTokenPriceCached(tokenOut),
    ])
    return new Decimal(inPrice).dividedBy(outPrice)
}

async function estimatePricesUsingCoingecko(
    tokenAmountIn: TokenAmount,
    tokenOut: Token,
    symbiosis: Symbiosis,
    cfg: PriceEstimationConfig
): Promise<Prices> {
    const price = await getCoingeckoPrice(tokenAmountIn.token, tokenOut, symbiosis)
    return {
        bestPrice: price.mul(1 - cfg.slippageNorm),
        slippedPrice: price.mul(1 - cfg.slippageMax),
    }
}

async function makeAggregatorTrade(context: SwapExactInParams, tokenAmountIn: TokenAmount): Promise<AggregatorTrade> {
    const aggregatorTrade = new AggregatorTrade({
        ...context,
        tokenAmountIn: tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        from: context.to, // there is no from address, set user's address
        clientId: context.symbiosis.clientId,
        preferOneInchUsage: isUseOneInchOnly(context),
    })
    await aggregatorTrade.init()
    return aggregatorTrade
}

async function estimatePricesUsingAggregators(context: SwapExactInParams, tokenAmountIn: TokenAmount): Promise<Prices> {
    const aggregatorTrade = await makeAggregatorTrade(context, tokenAmountIn)
    return amountsToPrices(aggregatorTrade, tokenAmountIn)
}

async function estimatePrices(
    context: SwapExactInParams,
    tokenAmountIn: TokenAmount,
    dep: DepositoryContext
): Promise<Prices> {
    if (dep.cfg.priceEstimation.enabled) {
        try {
            return await estimatePricesUsingCoingecko(
                tokenAmountIn,
                context.tokenOut,
                context.symbiosis,
                dep.cfg.priceEstimation
            )
        } catch (e) {
            console.warn('failed to estimate amount out', e)
        }
    }
    // Price estimation disabled - fallback to aggregators.
    return estimatePricesUsingAggregators(context, tokenAmountIn)
}

function tradeToMulticall(trade: SymbiosisTrade): MultiCallItem {
    return {
        amountIn: trade.tokenAmountIn,
        amountOut: trade.amountOut,
        amountOutMin: trade.amountOutMin,
        data: trade.callData,
        offset: trade.callDataOffset,
        to: trade.routerAddress,
        value: '0',
        priceImpact: trade.priceImpact,
        fees: [],
        routes: [],
    }
}

async function buildOnChainSwap(
    context: SwapExactInParams,
    btcConfig: BtcConfig,
    syBtcAmount: TokenAmount,
    syBtcAmountMin: TokenAmount
): Promise<SwapResult> {
    const { symbiosis } = context

    if (syBtcAmount.token.equals(context.tokenOut)) {
        // TODO: should ERC20 transfer be encoded?
        return { calls: [] }
    }
    let trade: SymbiosisTrade
    const dep = await symbiosis.depository(syBtcAmount.token.chainId)
    if (dep) {
        const prices = await estimatePrices(context, syBtcAmount, dep)
        trade = await buildBtcDepositCall(dep, {
            tradeParams: {
                ...context,
                tokenAmountIn: syBtcAmount,
                tokenAmountInMin: syBtcAmountMin,
            },
            refundAddress: context.refundAddress,
            btcConfig,
            depositParams: {
                to: context.to,
                extraBranches: [],
                tokenAmountIn: syBtcAmount,
                outToken: context.tokenOut,
                ...prices,
                ...dep.makeTargetCall(context),
            },
        })
    } else {
        trade = await makeAggregatorTrade(context, syBtcAmount)
    }
    return {
        calls: [tradeToMulticall(trade)],
        tradeA: trade,
    }
}

function decodeMetaRoute(calldata: BytesLike): MetaRouteStructs.MetaRouteTransactionStruct {
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', calldata)
    return result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct
}

async function buildCrossChainSwap(
    context: SwapExactInParams,
    btcConfig: BtcConfig,
    syBtcAmount: TokenAmount,
    syBtcAmountMin: TokenAmount
): Promise<SwapResultCrossChain> {
    const { to, symbiosis } = context

    const swapExactInResult = await crosschainSwap({
        ...context,
        tokenAmountIn: syBtcAmount,
        from: to, // to be able to revert a tx
        tradeAContext: 'multicallRouter',
        partnerAddress: undefined, // don't need to call partner fee twice
    })

    const tx = decodeMetaRoute((swapExactInResult.transactionRequest as TransactionRequest).data!)

    const dep = await symbiosis.depository(syBtcAmount.token.chainId)
    if (dep) {
        if (swapExactInResult.tradeA) {
            // There is DEX-swap on BSC, lock to Depository instead.
            const result = await buildBtcDepositCall(dep, {
                tradeParams: { ...context, tokenAmountIn: syBtcAmount, tokenAmountInMin: syBtcAmountMin },
                btcConfig,
                refundAddress: context.refundAddress,
                depositParams: {
                    ...context,
                    tokenAmountIn: syBtcAmount,
                    outToken: swapExactInResult.tradeA.amountOut.token,
                    ...amountsToPrices(swapExactInResult.tradeA, syBtcAmount),
                    target: tx.relayRecipient as NonEmptyAddress,
                    targetCalldata: tx.otherSideCalldata,
                    targetOffset: 100n, // metaSynthesize struct size
                    extraBranches: [],
                },
            })
            return {
                result: swapExactInResult,
                calls: [tradeToMulticall(result)],
            }
        } else {
            // There is no on-chain swap, Depository is not needed.
            return {
                result: swapExactInResult,
                calls: [
                    {
                        to: tx.relayRecipient,
                        data: tx.otherSideCalldata,
                        offset: 100, // metaSynthesize struct
                        fees: swapExactInResult.fees,
                        routes: swapExactInResult.routes,
                        value: '0',
                        amountIn: syBtcAmount,
                        amountOut: swapExactInResult.tokenAmountOut,
                        amountOutMin: swapExactInResult.tokenAmountOutMin,
                        priceImpact: swapExactInResult.priceImpact,
                    },
                ],
            }
        }
    } else {
        const calls: MultiCallItem[] = []
        let amountIn = syBtcAmount
        if (swapExactInResult.tradeA) {
            // There is DEX-swap on BSC
            calls.push({
                to: tx.firstDexRouter,
                data: tx.firstSwapCalldata,
                offset: swapExactInResult.tradeA.callDataOffset,
                fees: [],
                routes: [],
                value: '0',
                amountIn,
                amountOut: swapExactInResult.tradeA.amountOut,
                amountOutMin: swapExactInResult.tradeA.amountOutMin,
                priceImpact: new Percent('0', BIPS_BASE),
            })
            amountIn = swapExactInResult.tradeA.amountOut
        }

        calls.push({
            to: tx.relayRecipient,
            data: tx.otherSideCalldata,
            offset: 100, // metaSynthesize struct
            fees: swapExactInResult.fees,
            routes: swapExactInResult.routes,
            value: '0',
            amountIn,
            amountOut: swapExactInResult.tokenAmountOut,
            amountOutMin: swapExactInResult.tokenAmountOutMin,
            priceImpact: swapExactInResult.priceImpact,
        })
        return { calls, result: swapExactInResult }
    }
}

interface SyBtcDepositParams {
    tradeParams: SymbiosisTradeParams
    refundAddress?: BtcAddress | EmptyAddress
    btcConfig: BtcConfig
    depositParams: DepositParams
}

// Build Depository call with BTC refund.
async function buildBtcDepositCall(
    dep: DepositoryContext,
    { refundAddress, btcConfig, depositParams, tradeParams }: SyBtcDepositParams
): Promise<SymbiosisTrade> {
    // Optional BTC refund.
    if (refundAddress && dep.btcRefundUnlocker && dep.cfg.refundDelay) {
        const refundScript = getPkScript(refundAddress, btcConfig.btc.chainId)
        const btcRefundCondition = await dep.btcRefundUnlocker.encodeCondition({
            refundAddress: refundScript,
        })
        depositParams.extraBranches.push(
            dep.makeTimed(dep.cfg.refundDelay, {
                unlocker: dep.btcRefundUnlocker.address,
                condition: btcRefundCondition,
            })
        )
    } else {
        console.warn('locking btc without refund unlocker')
    }

    return await new DepositoryTrade(tradeParams, dep, depositParams).init()
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
    to: EvmAddress
    amount: string
    refundAddress?: BtcAddress
    clientId?: string
}
export type EstimateWrapBodyParams = {
    amount: number
    info: {
        portalFee: number
        op: number
        stableBridgingFee: number
        tail: string
        to: EvmAddress
    }
    refundAddress?: BtcAddress
    clientId?: string
}

async function estimateWrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    amount,
    refundAddress,
    clientId,
}: EstimateWrapParams): Promise<BigNumber> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const body: EstimateWrapBodyParams = {
        amount: Number(amount),
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - wrap operation
            stableBridgingFee: Number(stableBridgingFee),
            tail: encodeTail(tail),
            to,
        },
        clientId,
    }
    if (refundAddress) {
        body.refundAddress = refundAddress
    }

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(body),
    }

    const response = await fetch(`${estimateWrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new SdkError(json.message ?? text)
    }

    const { revealTxFee } = await response.json()

    return BigNumber.from(revealTxFee)
}

type WrapParams = EstimateWrapParams & {
    feeLimit: string
}
export type WrapBodyParams = EstimateWrapBodyParams & {
    feeLimit: number
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
    clientId,
}: WrapParams): Promise<DepositAddressResult> {
    const body: WrapBodyParams = {
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - is wrap operation
            stableBridgingFee: Number(stableBridgingFee),
            tail: encodeTail(tail),
            to,
        },
        clientId,
        feeLimit: Number(feeLimit),
        amount: Number(amount),
    }
    if (refundAddress) {
        body.refundAddress = refundAddress
    }

    const wrapApiUrl = new URL(`${forwarderUrl}/wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(body),
    }

    const response = await fetch(`${wrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new SdkError(json.message ?? text)
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

import { AddressZero } from '@ethersproject/constants'

import { Percent, TokenAmount } from '../../../entities'
import { BIPS_BASE } from '../../constants'
import { isTronChainId } from '../../chainUtils'
import TronWeb from 'tronweb'
import { ChangellyError, ChangellyTickerNotFoundError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade'
import type { ChangellyTransactionData, SwapExactInParams, SwapExactInResult } from '../../types'
import { isChangellyNativeChainId, isChangellyTradeChainId } from './constants'
import {
    buildChangellyTradeTx,
    type BuildChangellyTradeTxResult,
    type ChangellyEstimateResult,
    createChangellyDeposit,
    getChangellyEstimate,
} from './changellyTrade'
import { getChangellyTransitToken } from './constants'
import { changellyZappingSwap, isChangellyZappingSupported } from './zappingOnChainChangelly'
import { onchainSwap } from '../onchainSwap'
import { MULTICALL_ROUTER_V2 } from '../../constants'
import { FEE_COLLECTOR_ADDRESSES } from '../feeCollectorSwap'
import { FeeCollector__factory } from '../../contracts'
import type { Address } from '../../types'

const ZERO_PRICE_IMPACT = new Percent('0', BIPS_BASE)

function isChangellyDisabled(params: SwapExactInParams): boolean {
    return !!params.disabledProviders?.includes(SymbiosisTradeType.CHANGELLY)
}

/** True when a Changelly-native chain (XMR, XRP, LTC, ADA, BCH, XLM, SUI, DOGE, CC) is on either side. */
export function isChangellyNativeSupported(params: SwapExactInParams): boolean {
    if (isChangellyDisabled(params)) return false

    const fromChainId = params.tokenAmountIn.token.chainId
    const toChainId = params.tokenOut.chainId

    return isChangellyNativeChainId(fromChainId) || isChangellyNativeChainId(toChainId)
}

export async function changellyNativeSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const fromChainId = params.tokenAmountIn.token.chainId
    const execute = !!params.generateDepositAddress

    // Source is a Changelly-native chain (XMR, XRP, etc.) — user sends funds manually
    if (isChangellyNativeChainId(fromChainId)) {
        if (execute) {
            return changellyDepositSwap(params)
        }
        return changellyEstimateOnly(params, 'changelly-deposit')
    }

    // Source is a trade chain (EVM/Solana/TON/Tron) — SDK builds a transfer tx
    if (isChangellyTradeChainId(fromChainId)) {
        if (execute) {
            try {
                return await changellyTradeSwap(params)
            } catch (error) {
                if (error instanceof ChangellyTickerNotFoundError && isChangellyZappingSupported(params)) {
                    return changellyZappingSwap(params)
                }
                throw error
            }
        }
        try {
            return await changellyEstimateOnly(params, 'changelly-trade')
        } catch (error) {
            if (error instanceof ChangellyTickerNotFoundError && isChangellyZappingSupported(params)) {
                return changellyZappingEstimateOnly(params)
            }
            throw error
        }
    }

    throw new ChangellyError(`Unsupported source chain for Changelly: ${fromChainId}`)
}

export async function changellyDepositSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    const fromChainId = tokenAmountIn.token.chainId
    const refundAddress =
        params.refundAddress || (isTronChainId(fromChainId) ? TronWeb.address.fromHex(params.from) : params.from)
    const payoutAddress = isTronChainId(tokenOut.chainId) ? TronWeb.address.fromHex(params.to) : params.to

    const changellyData = await createChangellyDeposit(symbiosis, {
        currencyFrom: estimate.currencyFrom,
        currencyTo: estimate.currencyTo,
        amountFrom: estimate.amountFrom,
        rateId: estimate.rateId,
        address: payoutAddress,
        refundAddress,
        extraIdTo: params.changellyExtraIdTo,
    })

    return {
        ...baseResult(estimate),
        kind: 'changelly-deposit',
        transactionType: 'changelly',
        transactionRequest: changellyData,
    }
}

export async function changellyTradeSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    const fromChainId = tokenAmountIn.token.chainId
    const refundFallback = isTronChainId(fromChainId) ? TronWeb.address.fromHex(params.from) : params.from
    const payoutAddress = isTronChainId(tokenOut.chainId) ? TronWeb.address.fromHex(params.to) : params.to

    const tradeResult = await buildChangellyTradeTx(symbiosis, {
        currencyFrom: estimate.currencyFrom,
        currencyTo: estimate.currencyTo,
        amountFrom: estimate.amountFrom,
        rateId: estimate.rateId,
        amountExpectedTo: estimate.amountTo,
        address: payoutAddress,
        refundAddress: params.refundAddress || refundFallback,
        from: params.from,
        tokenAmountIn,
        extraIdTo: params.changellyExtraIdTo,
    })

    return toTradeResult(estimate, tradeResult)
}

const EMPTY_CHANGELLY_TX: ChangellyTransactionData = {
    changellyTxId: '',
    depositAddress: '',
    amountExpectedFrom: '',
    amountExpectedTo: '',
    networkFee: '',
    validUntil: 0,
    currencyFrom: '',
    currencyTo: '',
}

async function changellyEstimateOnly(
    params: SwapExactInParams,
    kind: 'changelly-deposit' | 'changelly-trade'
): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    return {
        ...baseResult(estimate),
        kind,
        transactionType: 'changelly',
        transactionRequest: EMPTY_CHANGELLY_TX,
    }
}

async function changellyZappingEstimateOnly(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const chainId = tokenAmountIn.token.chainId

    const transit = getChangellyTransitToken(chainId)
    if (!transit) {
        throw new ChangellyError(`No transit tokens for chain ${chainId}`)
    }

    const multicallRouterAddress = MULTICALL_ROUTER_V2[chainId]
    if (!multicallRouterAddress) {
        throw new ChangellyError(`MulticallRouterV2 not found for chain ${chainId}`)
    }

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[chainId]
    if (!feeCollectorAddress) {
        throw new ChangellyError(`Fee collector not found for chain ${chainId}`)
    }

    const provider = symbiosis.getProvider(chainId)
    const feeCollector = FeeCollector__factory.connect(feeCollectorAddress, provider)
    const [fee, approveAddress] = await symbiosis.cache.get(
        ['feeCollector.fee', 'feeCollector.onchainGateway', chainId.toString()],
        () => Promise.all([feeCollector.callStatic.fee(), feeCollector.callStatic.onchainGateway()]),
        60 * 60
    )

    // Deduct fee for native input (same as full zapping)
    let inTokenAmount = tokenAmountIn
    if (inTokenAmount.token.isNative) {
        const feeTokenAmount = new TokenAmount(inTokenAmount.token, fee.toString())
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new ChangellyError(`Amount too low to cover fee: min ${feeTokenAmount.toSignificant()}`)
        }
        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    // Estimate onchain swap: input → transit token (use multicall router as from/to like real zapping)
    const swapResult = await onchainSwap({
        ...params,
        tokenAmountIn: inTokenAmount,
        tokenOut: transit.token,
        from: multicallRouterAddress as Address,
        to: multicallRouterAddress as Address,
    })

    // Estimate Changelly: transit → destination
    const estimate = await getChangellyEstimate(symbiosis, swapResult.tokenAmountOut, tokenOut)

    return {
        ...baseResult(estimate),
        kind: 'changelly-trade',
        transactionType: 'changelly',
        transactionRequest: EMPTY_CHANGELLY_TX,
        approveTo: approveAddress,
        routes: [
            ...swapResult.routes,
            {
                provider: SymbiosisTradeType.CHANGELLY,
                tokens: [estimate.tokenInResolved, estimate.tokenOutResolved],
            },
        ],
        fees: [...swapResult.fees, ...estimate.fees],
    }
}

// --- Result builders ---

function baseResult(estimate: ChangellyEstimateResult) {
    return {
        tokenAmountOut: estimate.tokenAmountOut,
        tokenAmountOutMin: estimate.tokenAmountOut,
        priceImpact: ZERO_PRICE_IMPACT,
        approveTo: AddressZero,
        routes: [
            {
                provider: SymbiosisTradeType.CHANGELLY,
                tokens: [estimate.tokenInResolved, estimate.tokenOutResolved],
            },
        ],
        fees: estimate.fees,
        labels: ['partner-swap' as const, 'semi-centralized' as const],
    }
}

function toTradeResult(estimate: ChangellyEstimateResult, tradeResult: BuildChangellyTradeTxResult): SwapExactInResult {
    const base: Omit<SwapExactInResult, 'transactionType' | 'transactionRequest'> = {
        ...baseResult(estimate),
        kind: 'changelly-trade' as const,
        changellyData: tradeResult.changellyData,
    }

    switch (tradeResult.type) {
        case 'ton':
            return { ...base, transactionType: 'ton', transactionRequest: tradeResult.tx }
        case 'tron':
            return { ...base, transactionType: 'tron', transactionRequest: tradeResult.tx }
        case 'solana':
            return { ...base, transactionType: 'solana', transactionRequest: tradeResult.tx }
        case 'evm':
            return { ...base, transactionType: 'evm', transactionRequest: tradeResult.tx }
    }
}

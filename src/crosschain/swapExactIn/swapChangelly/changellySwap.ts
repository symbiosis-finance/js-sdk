import { AddressZero } from '@ethersproject/constants'

import { Percent } from '../../../entities'
import { BIPS_BASE } from '../../constants'
import { ChangellyError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import {
    isChangellyNativeChainId,
    isChangellyTradeChainId,
} from './constants'
import {
    type BuildChangellyTradeTxResult,
    buildChangellyTradeTx,
    createChangellyDeposit,
    getChangellyEstimate,
    type ChangellyEstimateResult,
} from './changellyTrade'

const ZERO_PRICE_IMPACT = new Percent('0', BIPS_BASE)

// --- Support checks ---

function isChangellyDisabled(params: SwapExactInParams): boolean {
    return !!params.disabledProviders?.includes(SymbiosisTradeType.CHANGELLY)
}

export function isChangellyDepositSupported(params: SwapExactInParams): boolean {
    if (isChangellyDisabled(params)) return false

    const fromChainId = params.tokenAmountIn.token.chainId
    const toChainId = params.tokenOut.chainId

    const hasNativeChain = isChangellyNativeChainId(fromChainId) || isChangellyNativeChainId(toChainId)
    if (!hasNativeChain) return false

    return !isChangellyTradeChainId(fromChainId)
}

export function isChangellyTradeSupported(params: SwapExactInParams): boolean {
    if (isChangellyDisabled(params)) return false

    const fromChainId = params.tokenAmountIn.token.chainId
    const toChainId = params.tokenOut.chainId

    if (!isChangellyTradeChainId(fromChainId)) return false
    if (!isChangellyNativeChainId(toChainId)) return false

    return true
}

// --- Swap functions ---

export async function changellyDepositSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    if (!params.changellyExecute) {
        return estimateResult(params, estimate, 'changelly-deposit')
    }

    if (!params.refundAddress) {
        throw new ChangellyError('Refund address is required for Changelly deposit')
    }

    const changellyData = await createChangellyDeposit(symbiosis, {
        currencyFrom: estimate.currencyFrom,
        currencyTo: estimate.currencyTo,
        amountFrom: estimate.amountFrom,
        rateId: estimate.rateId,
        address: params.to,
        refundAddress: params.refundAddress,
        extraIdTo: params.changellyExtraIdTo,
    })

    return {
        ...baseResult(params, estimate),
        kind: 'changelly-deposit',
        transactionType: 'changelly',
        transactionRequest: changellyData,
        changelly: changellyData,
    }
}

export async function changellyTradeSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    if (!params.changellyExecute) {
        return estimateResult(params, estimate, 'changelly-trade')
    }

    const tradeResult = await buildChangellyTradeTx(symbiosis, {
        currencyFrom: estimate.currencyFrom,
        currencyTo: estimate.currencyTo,
        amountFrom: estimate.amountFrom,
        rateId: estimate.rateId,
        amountExpectedTo: estimate.amountTo,
        address: params.to,
        refundAddress: params.refundAddress || params.from,
        from: params.from,
        tokenAmountIn,
        extraIdTo: params.changellyExtraIdTo,
    })

    return toTradeResult(params, estimate, tradeResult)
}

// --- Result builders ---

function baseResult(params: SwapExactInParams, estimate: ChangellyEstimateResult) {
    return {
        tokenAmountOut: estimate.tokenAmountOut,
        tokenAmountOutMin: estimate.tokenAmountOut,
        priceImpact: ZERO_PRICE_IMPACT,
        approveTo: AddressZero,
        routes: [
            {
                provider: SymbiosisTradeType.CHANGELLY,
                tokens: [params.tokenAmountIn.token, estimate.tokenOutResolved],
            },
        ],
        fees: estimate.fees,
        labels: [],
    }
}

function estimateResult(
    params: SwapExactInParams,
    estimate: ChangellyEstimateResult,
    kind: 'changelly-deposit' | 'changelly-trade'
): SwapExactInResult {
    return {
        ...baseResult(params, estimate),
        kind,
        transactionType: 'changelly',
        transactionRequest: {
            rateId: estimate.rateId,
            currencyFrom: estimate.currencyFrom,
            currencyTo: estimate.currencyTo,
            amountFrom: estimate.amountFrom,
            amountExpectedTo: estimate.amountTo,
        },
    }
}

function toTradeResult(
    params: SwapExactInParams,
    estimate: ChangellyEstimateResult,
    tradeResult: BuildChangellyTradeTxResult
): SwapExactInResult {
    const base = {
        ...baseResult(params, estimate),
        kind: 'changelly-trade' as const,
        changelly: tradeResult.changelly,
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

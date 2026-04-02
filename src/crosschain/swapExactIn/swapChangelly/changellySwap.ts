import { AddressZero } from '@ethersproject/constants'

import { Percent } from '../../../entities'
import { BIPS_BASE } from '../../constants'
import { evmAddressToTron, isTronChainId } from '../../chainUtils'
import { ChangellyError, ChangellyTickerNotFoundError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { isChangellyNativeChainId, isChangellyTradeChainId } from './constants'
import {
    type BuildChangellyTradeTxResult,
    buildChangellyTradeTx,
    createChangellyDeposit,
    getChangellyEstimate,
    type ChangellyEstimateResult,
} from './changellyTrade'
import { changellyZappingSwap as zappingSwap, isChangellyZappingSupported } from './zappingOnChainChangelly'

export { changellyZappingSwap, isChangellyZappingSupported } from './zappingOnChainChangelly'

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

    // Source is a Changelly-native chain (XMR, XRP, etc.) — user sends funds manually
    if (isChangellyNativeChainId(fromChainId)) {
        return changellyDepositSwap(params)
    }

    // Source is a trade chain (EVM/Solana/TON/Tron) — SDK builds a transfer tx
    // If token not on Changelly and zapping is available, fall back to DEX swap → transit → Changelly
    if (isChangellyTradeChainId(fromChainId)) {
        try {
            return await changellyTradeSwap(params)
        } catch (error) {
            if (!(error instanceof ChangellyTickerNotFoundError) || !isChangellyZappingSupported(params)) throw error
            return zappingSwap(params)
        }
    }
    
    throw new ChangellyError(`Unsupported source chain for Changelly: ${fromChainId}`)
}

export async function changellyDepositSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

    if (!params.changellyExecute) {
        return estimateResult(estimate, 'changelly-deposit')
    }

    if (!params.refundAddress) {
        throw new ChangellyError('Refund address is required for Changelly deposit')
    }

    const payoutAddress = isTronChainId(tokenOut.chainId) ? evmAddressToTron(params.to) : params.to

    const changellyData = await createChangellyDeposit(symbiosis, {
        currencyFrom: estimate.currencyFrom,
        currencyTo: estimate.currencyTo,
        amountFrom: estimate.amountFrom,
        rateId: estimate.rateId,
        address: payoutAddress,
        refundAddress: params.refundAddress,
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

    if (!params.changellyExecute) {
        return estimateResult(estimate, 'changelly-trade')
    }

    const fromChainId = tokenAmountIn.token.chainId
    const refundFallback = isTronChainId(fromChainId) ? evmAddressToTron(params.from) : params.from
    const payoutAddress = isTronChainId(tokenOut.chainId) ? evmAddressToTron(params.to) : params.to

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
        labels: ['partner-swap' as const],
    }
}

function estimateResult(
    estimate: ChangellyEstimateResult,
    kind: 'changelly-deposit' | 'changelly-trade'
): SwapExactInResult {
    return {
        ...baseResult(estimate),
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

function toTradeResult(estimate: ChangellyEstimateResult, tradeResult: BuildChangellyTradeTxResult): SwapExactInResult {
    const base = {
        ...baseResult(estimate),
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

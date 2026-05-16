import TronWeb from 'tronweb'

import { isTronChainId } from '../../chainUtils'
import { TradeProvider } from '../../trade'
import { withSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { isChangellyNativeChainId, EMPTY_CHANGELLY_TX } from './constants'
import { createChangellyDeposit, getChangellyEstimate } from './changellyTrade'
import { buildDepositResult } from '../deposit'

// The deposit case: source IS a Changelly-native chain (XMR, ZEC, etc.) — user manually sends funds.
export function isChangellyDepositSupported(params: SwapExactInParams): boolean {
    if (params.disabledProviders?.includes(TradeProvider.CHANGELLY)) return false
    return isChangellyNativeChainId(params.tokenAmountIn.token.chainId)
}

export async function changellyDepositSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    return withSpan('changellyDepositSwap', {}, async () => {
        const { symbiosis, tokenAmountIn, tokenOut } = params
        const execute = !!params.generateDepositAddress
        const estimate = await getChangellyEstimate(symbiosis, tokenAmountIn, tokenOut)

        const baseRoutes = [
            {
                provider: TradeProvider.CHANGELLY,
                tokens: [estimate.tokenInResolved, estimate.tokenOutResolved],
            },
        ]

        const baseLabels = ['partner-swap', 'semi-centralized'] as const

        if (!execute) {
            return buildDepositResult({
                transactionRequest: { provider: 'changelly', ...EMPTY_CHANGELLY_TX },
                tokenAmountOut: estimate.tokenAmountOut,
                routes: baseRoutes,
                fees: estimate.fees,
                labels: baseLabels,
            })
        }

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

        return buildDepositResult({
            transactionRequest: { provider: 'changelly', ...changellyData },
            tokenAmountOut: estimate.tokenAmountOut,
            routes: baseRoutes,
            fees: estimate.fees,
            labels: baseLabels,
        })
    })
}

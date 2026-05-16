import { AggregatorTrade } from '../trade'
import { withSpan } from '../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { preparePayload } from './preparePayload'

export function aggregatorsSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    return withSpan('aggregatorsSwap', {}, async () => {
        const {
            symbiosis,
            deadline,
            to,
            from,
            origin,
            slippage,
            tokenAmountIn,
            tokenOut,
            oneInchProtocols,
            disabledProviders,
        } = params

        const aggregatorTrade = new AggregatorTrade({
            symbiosis,
            to,
            from,
            origin,
            clientId: symbiosis.clientId,
            slippage,
            tokenAmountIn,
            tokenAmountInMin: tokenAmountIn, // correct as aggregatorsSwap is used for onchain swaps only
            tokenOut,
            deadline,
            oneInchProtocols,
            timeoutMs: 200,
            disabledProviders,
        })

        const endTimer = symbiosis.createMetricTimer()
        await aggregatorTrade.init()
        endTimer?.({
            kind: `onchain-swap`,
            operation: `${aggregatorTrade.tradeType}-onchain-swap`,
            tokenIn: tokenAmountIn.token,
            tokenOut: tokenOut,
        })

        const {
            amountOut,
            amountOutMin,
            callData,
            priceImpact,
            route,
            routerAddress,
            tradeType,
            functionSelector,
            approveTo,
            permit2Approve,
        } = aggregatorTrade

        const value = tokenAmountIn.token.isNative ? tokenAmountIn.raw.toString() : '0'

        const payload = preparePayload({
            functionSelector,
            chainId: tokenAmountIn.token.chainId,
            from,
            to: routerAddress,
            value,
            callData,
        })

        return {
            ...payload,
            operationType: 'onchain-swap',
            approveTo,
            tokenAmountOut: amountOut,
            tokenAmountOutMin: amountOutMin,
            priceImpact,
            fees: [],
            labels: [],
            routes: [
                {
                    provider: tradeType,
                    tokens: route,
                },
            ],
            permit2Approve,
        }
    })
}

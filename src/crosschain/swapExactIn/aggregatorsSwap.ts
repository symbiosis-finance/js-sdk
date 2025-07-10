import { AggregatorTrade } from '../trade'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from '../types'

export async function aggregatorsSwap({
    symbiosis,
    deadline,
    to,
    from,
    slippage,
    tokenAmountIn,
    tokenOut,
    oneInchProtocols,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const aggregatorTrade = new AggregatorTrade({
        symbiosis,
        to,
        from,
        clientId: symbiosis.clientId,
        slippage,
        tokenAmountIn,
        tokenOut,
        deadline,
        oneInchProtocols,
    })

    const id = crypto.randomUUID()
    const endTimer = symbiosis.createMetricTimer({
        id: id,
        kind: `${aggregatorTrade.tradeType}-onchain-swap`,
        operation: 'aggregator-swap',
        tokenIn: tokenAmountIn.token,
        tokenOut: tokenOut,
        addressFrom: from,
        addressTo: to,
    })
    await aggregatorTrade.init()
    endTimer()

    const { amountOut, amountOutMin, callData, priceImpact, route, routerAddress, tradeType, functionSelector } =
        aggregatorTrade

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
        kind: 'onchain-swap',
        approveTo: routerAddress,
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOutMin,
        priceImpact,
        fees: [],
        routes: [
            {
                provider: tradeType,
                tokens: route,
            },
        ],
    }
}

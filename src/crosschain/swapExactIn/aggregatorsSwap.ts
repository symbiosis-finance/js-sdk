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

    await aggregatorTrade.init()

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

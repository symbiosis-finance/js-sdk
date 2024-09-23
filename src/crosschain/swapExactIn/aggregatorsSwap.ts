import { DataProvider } from '../dataProvider'
import { AggregatorTrade } from '../trade'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from './types'

export async function aggregatorsSwap({
    symbiosis,
    deadline,
    toAddress,
    fromAddress,
    slippage,
    inTokenAmount,
    outToken,
    oneInchProtocols,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const dataProvider = new DataProvider(symbiosis)
    const ttl = deadline - Math.floor(Date.now() / 1000)
    const aggregatorTrade = new AggregatorTrade({
        symbiosis,
        to: toAddress,
        from: fromAddress,
        clientId: symbiosis.clientId,
        dataProvider,
        slippage,
        tokenAmountIn: inTokenAmount,
        tokenOut: outToken,
        ttl,
        oneInchProtocols,
    })

    await aggregatorTrade.init()

    const { amountOut, amountOutMin, callData, priceImpact, route, routerAddress, tradeType, functionSelector } =
        aggregatorTrade

    const value = inTokenAmount.token.isNative ? inTokenAmount.raw.toString() : '0'

    const payload = preparePayload({
        functionSelector,
        chainId: inTokenAmount.token.chainId,
        fromAddress,
        toAddress: routerAddress,
        value,
        callData,
    })

    return {
        kind: 'onchain-swap',
        approveTo: routerAddress,
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOutMin,
        priceImpact,
        route,
        inTradeType: tradeType,
        ...payload,
        fees: [], // TODO
        routes: [], // TODO
    }
}

import { DataProvider } from '../dataProvider'
import { AggregatorTrade } from '../trade'
import { preparePayload } from './preparePayload'
import { SwapExactInContex, SwapExactInOnchain, SwapExactInTransactionPayload } from './types'

export async function onchainSwap({
    symbiosis,
    deadline,
    toAddress,
    fromAddress,
    slippage,
    inAmount,
    outToken,
    oneInchProtocols,
    inTokenChainId,
}: SwapExactInContex): Promise<SwapExactInOnchain & SwapExactInTransactionPayload> {
    const dataProvider = new DataProvider(symbiosis)
    const ttl = deadline - Math.floor(Date.now() / 1000)
    const aggregatorTrade = new AggregatorTrade({
        symbiosis,
        to: toAddress,
        from: fromAddress,
        clientId: symbiosis.clientId,
        dataProvider,
        slippage,
        tokenAmountIn: inAmount,
        tokenOut: outToken,
        ttl,
        oneInchProtocols,
    })

    await aggregatorTrade.init()

    const { amountOut, amountOutMin, callData, priceImpact, route, routerAddress, tradeType } = aggregatorTrade

    const value = inAmount.token.isNative ? inAmount.raw.toString() : '0'

    const payload = preparePayload({
        chainId: inTokenChainId,
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
        tradeType,
        ...payload,
    }
}

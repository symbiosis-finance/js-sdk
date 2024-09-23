import { SwapExactInParams, SwapExactInResult } from './types'
import { MagpieTrade } from '../trade/magpieTrade'

export async function magpieSwap({
    symbiosis,
    inTokenAmount,
    outToken,
    fromAddress,
    toAddress,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new MagpieTrade({
        symbiosis,
        tokenAmountIn: inTokenAmount,
        tokenOut: outToken,
        from: fromAddress,
        to: toAddress,
        slippage,
    })

    await trade.init()

    return {
        kind: 'onchain-swap',
        route: [inTokenAmount.token, outToken],
        tokenAmountOut: trade.amountOut,
        approveTo: trade.routerAddress,
        priceImpact: trade.priceImpact,
        transactionType: 'evm',
        inTradeType: 'magpie',
        transactionRequest: {
            to: trade.routerAddress,
            data: trade.callData,
            value: inTokenAmount.token.isNative ? inTokenAmount.raw.toString() : undefined,
        },
        fees: [], // TODO
        routes: [], // TODO
    }
}

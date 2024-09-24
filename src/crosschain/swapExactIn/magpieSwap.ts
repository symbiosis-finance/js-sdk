import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'

export async function magpieSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new MagpieTrade({
        symbiosis,
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
    })

    await trade.init()

    return {
        kind: 'onchain-swap',
        route: [tokenAmountIn.token, tokenOut],
        tokenAmountOut: trade.amountOut,
        approveTo: trade.routerAddress,
        priceImpact: trade.priceImpact,
        transactionType: 'evm',
        inTradeType: 'magpie',
        transactionRequest: {
            to: trade.routerAddress,
            data: trade.callData,
            value: tokenAmountIn.token.isNative ? tokenAmountIn.raw.toString() : undefined,
        },
        fees: [], // TODO
        routes: [], // TODO
    }
}

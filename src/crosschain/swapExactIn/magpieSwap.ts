import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'
import { TokenAmount } from '../../entities'

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
        tokenAmountOut: trade.amountOut,
        tokenAmountOutMin: trade.amountOutMin,
        approveTo: trade.routerAddress,
        priceImpact: trade.priceImpact,
        transactionType: 'evm',
        transactionRequest: {
            to: trade.routerAddress,
            data: trade.callData,
            value: tokenAmountIn.token.isNative ? tokenAmountIn.raw.toString() : undefined,
        },
        fees: [
            {
                value: new TokenAmount(tokenOut, '0'),
                description: 'Magpie fee',
            },
        ],
        routes: [
            {
                provider: 'magpie',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

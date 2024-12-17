import { SwapExactInParams, SwapExactInResult } from '../types'
import { StonfiTrade } from '../trade'
import { isTonChainId } from '../chainUtils'

export function isStonfiSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    // [TODO]: Check with stonfi dex
    if (isTonChainId(tokenAmountIn.token.chainId) && isTonChainId(tokenOut.chainId)) {
        return true
    }

    return false
}

export async function stonfiSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
    deadline,
}: SwapExactInParams): Promise<SwapExactInResult> {
    console.log('stonfiSwap --->', {
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
    })

    const trade = new StonfiTrade({
        symbiosis,
        tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
    })

    await trade.init()

    return {
        kind: 'onchain-swap',
        tokenAmountOut: trade.amountOut,
        tokenAmountOutMin: trade.amountOutMin,
        priceImpact: trade.priceImpact,
        transactionType: 'ton',
        transactionRequest: {
            validUntil: trade.deadline,
            messages: [
                {
                    address: trade.routerAddress,
                    amount: tokenAmountIn.raw.toString(),
                    payload: trade.callData,
                },
            ],
        },
        fees: [],
        routes: [
            {
                provider: 'stonfi',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

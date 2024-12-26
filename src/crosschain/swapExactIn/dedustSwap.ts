import { SwapExactInParams, SwapExactInResult } from '../types'
import { isTonChainId } from '../chainUtils'
import { DedustTrade } from '../trade/dedustTrade'

export async function isDedustSwapSupported(context: SwapExactInParams): Promise<boolean> {
    const { tokenAmountIn, tokenOut } = context

    if (isTonChainId(tokenAmountIn.token.chainId) && isTonChainId(tokenOut.chainId)) {
        return true
    }

    return false
}

export async function dedustSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
    deadline,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new DedustTrade({
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
        approveTo: '0x0000000000000000000000000000000000000000',
        transactionRequest: {
            validUntil: trade.deadline,
            messages: [
                {
                    address: trade.routerAddress,
                    amount: trade.value?.toString() ?? '0',
                    payload: trade.callData,
                },
            ],
        },
        fees: [],
        routes: [
            {
                provider: 'dedust',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

import { SwapExactInParams, SwapExactInResult } from '../types'
import { isTonChainId } from '../chainUtils'
import { DedustTrade } from '../trade/dedustTrade'

export function isDedustSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    return isTonChainId(tokenAmountIn.token.chainId) && isTonChainId(tokenOut.chainId)
}

export async function dedustSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut } = params
    const trade = new DedustTrade({
        ...params,
        tokenAmountInMin: tokenAmountIn,
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
        fees: trade.fees ?? [],
        routes: [
            {
                provider: 'dedust',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

import { SwapExactInParams, SwapExactInResult } from '../types'
import { StonfiTrade } from '../trade'
import { isTonChainId } from '../chainUtils'

export async function isStonfiSwapSupported(context: SwapExactInParams): Promise<boolean> {
    const { tokenAmountIn, tokenOut } = context

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
    const trade = new StonfiTrade({
        symbiosis,
        tokenAmountIn,
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
                provider: 'stonfi',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

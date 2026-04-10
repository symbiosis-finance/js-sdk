import { isTonChainId } from '../chainUtils'
import { StonfiTrade, TradeProvider } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'

export function isStonfiSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    return isTonChainId(tokenAmountIn.token.chainId) && isTonChainId(tokenOut.chainId)
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
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
    })

    await trade.init().catch((e) => {
        symbiosis.trackAggregatorError({
            provider: TradeProvider.STONFI,
            reason: e.message,
            chain_id: String(tokenOut.chain?.id),
        })
        throw e
    })

    return {
        operationType: 'onchain-swap',
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
        labels: [],
        routes: [
            {
                provider: TradeProvider.STONFI,
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

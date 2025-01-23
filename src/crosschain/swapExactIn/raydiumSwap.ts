import { SwapExactInParams, SwapExactInResult } from '../types'
import { RaydiumTrade } from '../trade'
import { isSolanaChainId } from '../chainUtils'

export function isRaydiumSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    return isSolanaChainId(tokenAmountIn.token.chainId) && isSolanaChainId(tokenOut.chainId)
}

export async function raydiumSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new RaydiumTrade({
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
        priceImpact: trade.priceImpact,
        transactionType: 'solana',
        approveTo: '0x0000000000000000000000000000000000000000',
        transactionRequest: {
            instructions: trade.instructions!,
        },
        fees: [],
        routes: [
            {
                provider: 'raydium',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

import { SwapExactInParams, SwapExactInResult } from '../types'
import { RadiumTrade } from '../trade'
import { isSolanaChainId } from '../chainUtils'

export function isRadiumSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    if (isSolanaChainId(tokenAmountIn.token.chainId) && isSolanaChainId(tokenOut.chainId)) {
        return true
    }

    return false
}

export async function radiumSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const trade = new RadiumTrade({
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
        fees: trade.fees ?? [],
        routes: [
            {
                provider: 'radium',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}
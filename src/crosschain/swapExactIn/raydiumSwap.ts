import { addSolanaFee, isSolanaChainId } from '../chainUtils'
import { RaydiumTrade, TradeProvider } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'

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
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
    })

    await trade.init().catch((e) => {
        symbiosis.trackAggregatorError({
            provider: TradeProvider.RAYDIUM,
            reason: e.message,
            chain_id: String(tokenOut.chain?.id),
        })
        throw e
    })

    const { instructions, fee } = await addSolanaFee(from, trade.instructions)

    return {
        operationType: 'onchain-swap',
        tokenAmountOut: trade.amountOut,
        tokenAmountOutMin: trade.amountOutMin,
        priceImpact: trade.priceImpact,
        transactionType: 'solana',
        approveTo: '0x0000000000000000000000000000000000000000',
        transactionRequest: {
            instructions,
        },
        fees: [
            {
                provider: TradeProvider.SYMBIOSIS,
                value: fee,
                description: 'Symbiosis on-chain fee',
            },
        ],
        labels: [],
        routes: [
            {
                provider: TradeProvider.RAYDIUM,
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

import { OctoPoolTrade } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'

export function isOctoPoolSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, symbiosis } = context

    if (!tokenAmountIn.token.isSynthetic || !tokenOut.isSynthetic) {
        return false
    }

    const tokenInPool = symbiosis.getOmniPoolByToken(tokenAmountIn.token)
    const tokenOutPool = symbiosis.getOmniPoolByToken(tokenOut)
    if (!tokenInPool || !tokenOutPool) {
        return false
    }

    return tokenInPool.id === tokenOutPool.id
}

export async function octoPoolSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    to,
    slippage,
    deadline,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const tokenInPool = symbiosis.getOmniPoolByToken(tokenAmountIn.token)
    const tokenOutPool = symbiosis.getOmniPoolByToken(tokenOut)
    if (!tokenInPool || !tokenOutPool) {
        throw new Error('Incorrect tokens for octoPoolSwap')
    }

    const trade = new OctoPoolTrade({
        symbiosis,
        tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        poolConfig: tokenInPool,
        to,
        slippage,
        deadline,
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
        fees: [],
        routes: [
            {
                provider: 'octopool',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

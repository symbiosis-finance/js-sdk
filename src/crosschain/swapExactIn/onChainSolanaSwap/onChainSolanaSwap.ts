import { SwapExactInParams, SwapExactInResult } from '../../types'
import { addSolanaFee, isSolanaChainId } from '../../chainUtils'
import { JupiterTrade, RaydiumTrade } from '../../trade'

export function isOnChainSolanaSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = context

    return isSolanaChainId(tokenAmountIn.token.chainId) && isSolanaChainId(tokenOut.chainId)
}

export function onChainSolanaSwap({
    symbiosis,
    tokenAmountIn,
    tokenOut,
    from,
    to,
    slippage,
}: SwapExactInParams): Promise<SwapExactInResult>[] {
    const raydiumTradeInstance = new RaydiumTrade({
        symbiosis,
        tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
    })

    const jupiterTradeInstance = new JupiterTrade({
        symbiosis,
        tokenAmountIn,
        tokenAmountInMin: tokenAmountIn,
        tokenOut,
        to,
        slippage,
    })

    const tradeInstances = [raydiumTradeInstance, jupiterTradeInstance]

    return tradeInstances.map(async (instance) => {
        const trade = await instance.init().catch((e) => {
            symbiosis.trackAggregatorError({
                provider: instance.tradeType,
                reason: e.message,
                chain_id: String(tokenOut.chain?.id),
            })
            throw e
        })

        const { instructions, fee } = await addSolanaFee(from, trade.instructions)

        return {
            kind: 'onchain-swap',
            tokenAmountOut: trade.amountOut,
            tokenAmountOutMin: trade.amountOutMin,
            priceImpact: trade.priceImpact,
            transactionType: 'solana',
            approveTo: '0x0000000000000000000000000000000000000000',
            transactionRequest: {
                instructions,
            },
            fees: fee
                ? [
                      {
                          provider: 'symbiosis',
                          value: fee,
                          description: 'Symbiosis on-chain fee',
                      },
                  ]
                : [],
            routes: [
                {
                    provider: trade.tradeType,
                    tokens: [tokenAmountIn.token, tokenOut],
                },
            ],
        } as SwapExactInResult
    })
}

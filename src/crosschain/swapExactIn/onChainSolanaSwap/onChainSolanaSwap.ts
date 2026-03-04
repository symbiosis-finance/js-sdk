import { addSolanaFee, isSolanaChainId } from '../../chainUtils/solana'
import { JupiterTrade, RaydiumTrade } from '../../trade'
import { SymbiosisTradeType } from '../../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../../types'

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
    disabledProviders,
}: SwapExactInParams): Promise<SwapExactInResult>[] {
    const tradeInstances: (RaydiumTrade | JupiterTrade)[] = []

    if (RaydiumTrade.isAllowed(disabledProviders)) {
        tradeInstances.push(
            new RaydiumTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin: tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage,
            })
        )
    }

    if (JupiterTrade.isAllowed(disabledProviders)) {
        tradeInstances.push(
            new JupiterTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin: tokenAmountIn,
                tokenOut,
                to,
                slippage,
            })
        )
    }

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
                          provider: SymbiosisTradeType.SYMBIOSIS,
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

import { SwapExactInParams, SwapExactInResult } from '../../types'
import { addSolanaFee, isSolanaChainId } from '../../chainUtils'
import { JupiterTrade, RaydiumTrade } from '../../trade'
import { TokenAmount } from '../../../entities'

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
    // TODO: clarify how to handle custom recipient
    if (from !== to) {
        throw new Error("Can't swap to custom recipient")
    }

    const raydiumTradeInstance = new RaydiumTrade({
        symbiosis,
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
    })

    const jupiterTradeInstance = new JupiterTrade({
        symbiosis,
        tokenAmountIn,
        tokenOut,
        to,
        slippage,
    })

    const tradeInstances = [raydiumTradeInstance, jupiterTradeInstance]

    return tradeInstances.map(async (instance) => {
        const trade = await instance.init()

        let instructions = trade.instructions
        let fee: TokenAmount | null = null
        // TODO: jupiter has error with lookup table, native jupiter mechanic only subtract from output amount in custom token
        if (trade.tradeType === 'raydium') {
            const { instructions: patchedInstructions, fee: solanaFee } = await addSolanaFee(from, trade.instructions)
            instructions = patchedInstructions
            fee = solanaFee
        }

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

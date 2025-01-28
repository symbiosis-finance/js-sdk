import { SwapExactInParams, SwapExactInResult } from '../types'
import { RaydiumTrade } from '../trade'
import { addSolanaFee, isSolanaChainId, SOL_FEE_AMOUNT } from '../chainUtils'
import { GAS_TOKEN, TokenAmount } from '../../entities'
import { ChainId } from '../../constants'

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

    const withFeeInstructions = await addSolanaFee(from, trade)

    return {
        kind: 'onchain-swap',
        tokenAmountOut: trade.amountOut,
        tokenAmountOutMin: trade.amountOutMin,
        priceImpact: trade.priceImpact,
        transactionType: 'solana',
        approveTo: '0x0000000000000000000000000000000000000000',
        transactionRequest: {
            instructions: withFeeInstructions,
        },
        fees: [
            {
                provider: 'symbiosis',
                value: new TokenAmount(GAS_TOKEN[ChainId.SOLANA_MAINNET], BigInt(SOL_FEE_AMOUNT)),
                description: 'Symbiosis on-chain fee',
            },
        ],
        routes: [
            {
                provider: 'raydium',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

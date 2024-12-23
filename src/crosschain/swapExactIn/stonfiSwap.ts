import { SwapExactInParams, SwapExactInResult } from '../types'
import { StonfiTrade } from '../trade'
import { getTonTokenAddress, isTonChainId } from '../chainUtils'
import { StonApiClient } from '@ston-fi/api'

export async function isStonfiSwapSupported(context: SwapExactInParams): Promise<boolean> {
    const stonClient = new StonApiClient()
    const { tokenAmountIn, tokenOut } = context

    if (!isTonChainId(tokenAmountIn.token.chainId) || !isTonChainId(tokenOut.chainId)) {
        return false
    }

    try {
        await Promise.all([
            stonClient.getAsset(getTonTokenAddress(tokenAmountIn.token.address, true)),
            stonClient.getAsset(getTonTokenAddress(tokenOut.address, true)),
        ])

        return true
    } catch (error) {
        console.error('Stonfi swap not supported these pair of tokens', error)
        return false
    }
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

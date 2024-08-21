import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'

export async function crosschainSwap({
    symbiosis,
    deadline,
    fromAddress,
    slippage,
    toAddress,
    inTokenAmount,
    outToken,
    oneInchProtocols,
    middlewareCall,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const bestPoolSwapping = symbiosis.bestPoolSwapping()

    const {
        type: transactionType,
        transactionRequest,
        ...result
    } = await bestPoolSwapping.exactIn({
        deadline,
        from: fromAddress,
        slippage,
        to: toAddress,
        tokenAmountIn: inTokenAmount,
        tokenOut: outToken,
        oneInchProtocols,
        middlewareCall,
    })

    const payload = { transactionType, transactionRequest } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...result,
        ...payload,
    }
}

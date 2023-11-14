import { SwapExactInContex, SwapExactInCrosschain, SwapExactInTransactionPayload } from './types'

export async function crosschainSwap({
    symbiosis,
    deadline,
    fromAddress,
    slippage,
    toAddress,
    inAmount,
    outToken,
    oneInchProtocols,
}: SwapExactInContex): Promise<SwapExactInCrosschain & SwapExactInTransactionPayload> {
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
        tokenAmountIn: inAmount,
        tokenOut: outToken,
        oneInchProtocols,
    })

    const payload = { transactionType, transactionRequest } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...result,
        ...payload,
    }
}

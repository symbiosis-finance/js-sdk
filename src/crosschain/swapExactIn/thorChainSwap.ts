import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'

export async function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    const omniPool = context.symbiosis.config.omniPools[0]
    const zappingThor = context.symbiosis.newZappingThor(omniPool)

    const result = await zappingThor.exactIn({
        tokenAmountIn: inTokenAmount,
        from: context.fromAddress,
        to: context.toAddress,
        slippage: context.slippage,
        deadline: context.deadline,
    })

    const payload = {
        transactionType: result.type,
        transactionRequest: result.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...result,
        ...payload,
    }
}

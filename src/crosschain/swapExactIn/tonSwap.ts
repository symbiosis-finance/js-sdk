import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'

export async function tonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    const omniPool = context.symbiosis.config.omniPools[1] // WETH
    const zappingTon = context.symbiosis.newZappingTon(omniPool)

    const result = await zappingTon.exactIn({
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

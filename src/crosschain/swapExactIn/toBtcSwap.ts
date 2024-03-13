import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { ChainId } from '../../constants'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { outToken } = context

    const isThorChainSwapSupported = outToken.chainId === ChainId.BTC_MAINNET

    const isNativeSwapSupported = false // TODO

    return isThorChainSwapSupported || isNativeSwapSupported
}
export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
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

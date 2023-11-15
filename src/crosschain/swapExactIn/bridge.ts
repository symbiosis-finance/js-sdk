import { wrappedToken } from '../../entities'
import { SwapExactInBridge, SwapExactInParams, SwapExactInTransactionPayload } from './types'

export function isBridgeSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount, outToken, symbiosis } = context

    const wrappedInToken = wrappedToken(inTokenAmount.token)
    const wrappedOutToken = wrappedToken(outToken)

    if (wrappedInToken.chainId === wrappedOutToken.chainId) {
        return false
    }

    const representation = symbiosis.getRepresentation(wrappedInToken, wrappedOutToken.chainId)

    return !!representation && representation.equals(wrappedOutToken)
}

export async function bridge(context: SwapExactInParams): Promise<SwapExactInBridge & SwapExactInTransactionPayload> {
    const { inTokenAmount, outToken } = context

    const briging = context.symbiosis.newBridging()

    const result = await briging.exactIn({
        from: context.fromAddress,
        to: context.toAddress,
        tokenAmountIn: inTokenAmount,
        tokenOut: outToken,
    })

    const payload = {
        transactionType: result.type,
        transactionRequest: result.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'bridge',
        fee: result.fee,
        tokenAmountOut: result.tokenAmountOut,
        ...payload,
    }
}

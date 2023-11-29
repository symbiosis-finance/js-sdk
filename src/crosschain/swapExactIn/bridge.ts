import { wrappedToken } from '../../entities'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'

export function isBridgeSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount, outToken, symbiosis } = context

    const wrappedInToken = wrappedToken(inTokenAmount.token)
    const wrappedOutToken = wrappedToken(outToken)

    if (wrappedInToken.chainId === wrappedOutToken.chainId) {
        return false
    }

    try {
        const representation = symbiosis.getRepresentation(wrappedInToken, wrappedOutToken.chainId)
        return !!representation && representation.equals(wrappedOutToken)
    } catch {
        return false
    }
}

export async function bridge(context: SwapExactInParams): Promise<SwapExactInResult> {
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

    let approveTo: string
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else {
        approveTo = payload.transactionRequest.to as string
    }
    return {
        kind: 'bridge',
        route: [inTokenAmount.token, outToken],
        fee: result.fee,
        tokenAmountOut: result.tokenAmountOut,
        approveTo,
        ...payload,
    }
}

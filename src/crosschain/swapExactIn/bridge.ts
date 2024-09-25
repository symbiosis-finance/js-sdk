import { Percent, wrappedToken } from '../../entities'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../types'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

export function isBridgeSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, symbiosis } = context

    const wrappedInToken = wrappedToken(tokenAmountIn.token)
    const wrappedOutToken = wrappedToken(tokenOut)

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
    const { tokenAmountIn, tokenOut, from, to } = context

    const bridging = context.symbiosis.newBridging()

    const result = await bridging.exactIn({
        from: from,
        to: to,
        tokenAmountIn,
        tokenOut,
    })

    const payload = {
        transactionType: result.type,
        transactionRequest: result.transactionRequest,
    } as SwapExactInTransactionPayload

    let approveTo: string = AddressZero
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else if (payload.transactionType === 'evm') {
        approveTo = payload.transactionRequest.to as string
    }
    return {
        ...payload,
        kind: 'bridge',
        tokenAmountOut: result.tokenAmountOut,
        tokenAmountOutMin: result.tokenAmountOut,
        priceImpact: new Percent('0', '0'),
        approveTo,
        fees: [
            {
                description: 'Bridge fee',
                value: result.fee,
            },
        ],
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

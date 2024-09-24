import { aggregatorsSwap } from './aggregatorsSwap'
import { isOKXSwapSupported, okxSwap } from './okxSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'
import { magpieSwap } from './magpieSwap'

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const requests: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    if (isOKXSwapSupported(params)) {
        requests.push(okxSwap(params))
    }
    if (MagpieTrade.isAvailable(params.tokenAmountIn.token.chainId)) {
        requests.push(magpieSwap(params))
    }

    const settled = await Promise.allSettled(requests)

    const errors: Error[] = []
    let bestResult: SwapExactInResult | undefined = undefined

    for (const result of settled) {
        if (result.status === 'rejected') {
            errors.push(result.reason)
            continue
        }

        const { value } = result

        if (!bestResult) {
            bestResult = value
            continue
        }

        if (value.tokenAmountOut.greaterThan(bestResult.tokenAmountOut)) {
            bestResult = value
        }
    }

    if (!bestResult) {
        throw new AggregateError(errors, 'No aggregator found')
    }

    return bestResult
}

import { SwapExactInParams, SwapExactInResult } from './types'
import { thorChainSwap } from './thorChainSwap'
import { burnSyntheticBtc } from './burnSyntheticBtc'
import { isBtc } from '../utils'
import { Error } from '../error'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { outToken } = context

    return isBtc(outToken.chainId)
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const results = await Promise.allSettled([
        burnSyntheticBtc(context), // symbiosis native
        thorChainSwap(context),
    ])

    let bestResult: SwapExactInResult | undefined
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    if (!bestResult) {
        throw new Error(`Can't build route upto the BTC`)
    }

    return bestResult
}

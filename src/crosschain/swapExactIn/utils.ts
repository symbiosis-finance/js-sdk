import type { SdkError } from '../sdkError'
import { AggregateSdkError, NoRouteError } from '../sdkError'
import type { SwapExactInResult } from '../types'

export interface TheBestOptions {
    onError?: (error: SdkError) => void
}

export async function theBest(
    promises: Promise<SwapExactInResult>[],
    options?: TheBestOptions
): Promise<SwapExactInResult> {
    if (promises.length === 0) {
        throw new NoRouteError('No promises provided')
    }

    const results = await Promise.allSettled(promises)

    let bestResult: SwapExactInResult | undefined
    const errors: SdkError[] = []
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            errors.push(item.reason)
            options?.onError?.(item.reason)
            continue
        }

        const { value } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThan(value.tokenAmountOut)) {
            continue
        }

        bestResult = value
    }

    if (!bestResult) {
        throw new AggregateSdkError(errors, `theBest: all routes failed. tried ${promises.length} ones.`)
    }

    return bestResult
}

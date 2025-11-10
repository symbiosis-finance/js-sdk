import { SelectMode, SwapExactInResult } from '../types'
import { NoRouteError, SdkError } from '../sdkError'

export async function theBest(promises: Promise<SwapExactInResult>[], mode?: SelectMode) {
    if (promises.length === 0) {
        throw new NoRouteError('No promises provided')
    }

    if (mode === 'fastest') {
        return Promise.any(promises)
    }

    // best_return mode
    const results = await Promise.allSettled(promises)

    let result: SwapExactInResult | undefined
    const errors: SdkError[] = []
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            errors.push(item.reason)
            continue
        }

        const { value } = item

        if (result && result.tokenAmountOut.greaterThan(value.tokenAmountOut)) {
            continue
        }

        result = value
    }

    if (!result) {
        throw new SdkError('Build route error', errors)
    }

    return result
}

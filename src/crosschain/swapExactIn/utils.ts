import { SelectMode, SwapExactInResult } from '../types'
import { Error } from '../error'

export async function theBest(promises: Promise<SwapExactInResult>[], mode?: SelectMode) {
    if (mode === 'fastest') {
        return Promise.any(promises)
    }

    // best_return mode
    const results = await Promise.allSettled(promises)

    let result: SwapExactInResult | undefined
    const errors: Error[] = []
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
        throw new AggregateError(errors, 'Build route error')
    }

    return result
}

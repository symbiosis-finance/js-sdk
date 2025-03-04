import { SelectMode, SwapExactInResult } from '../types'
import { Error, ErrorCode } from '../error'

export async function theBest(promises: Promise<SwapExactInResult>[], mode?: SelectMode) {
    if (promises.length === 0) {
        throw new Error(`No route`, ErrorCode.NO_TRANSIT_TOKEN)
    }

    if (mode === 'fastest') {
        return Promise.any(promises)
    }

    // best_return
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
        const specificError = errors.find((error) => error.code === ErrorCode.MIN_CHAINFLIP_AMOUNT_IN)
        if (specificError) {
            throw specificError
        }
        throw AggregateError(errors, 'Build route error')
    }

    return result
}

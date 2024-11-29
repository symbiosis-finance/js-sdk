import { SwapExactInResult } from '../types'
import { Error, ErrorCode } from '../error'

export async function theFastestAnswer(promises: Promise<SwapExactInResult>[]): Promise<SwapExactInResult> {
    return Promise.any(promises)
}

export async function theBestOutput(promises: Promise<SwapExactInResult>[]) {
    if (promises.length === 0) {
        throw new Error(`No route`, ErrorCode.NO_TRANSIT_TOKEN)
    }

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
        throw AggregateError(errors, 'Build route error')
    }

    return result
}

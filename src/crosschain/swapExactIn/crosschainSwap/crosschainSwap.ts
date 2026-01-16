import { flatten, withSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { bestPoolSwapping } from './bestPoolSwapping'

export async function crosschainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    // @ts-expect-error it actually shouldn't be too deep.
    const attrs = flatten(params)
    return await withSpan(
        'crosschainSwap',
        attrs,
        () => bestPoolSwapping(params),
        (res) => ({
            tokenAmountOut: res.tokenAmountOut.toString(),
            tokenAmountOutMin: res.tokenAmountOutMin.toString(),
        })
    )
}

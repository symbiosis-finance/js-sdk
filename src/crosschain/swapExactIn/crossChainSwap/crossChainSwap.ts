import { flatten, withSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { bestPoolSwapping } from './bestPoolSwapping'

export async function crossChainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    // @ts-expect-error it actually shouldn't be too deep.
    const attrs = flatten(params)
    return await withSpan(
        'crossChainSwap',
        attrs,
        () => bestPoolSwapping(params),
        (res) => ({
            tokenAmountOut: res.tokenAmountOut.toString(),
            tokenAmountOutMin: res.tokenAmountOutMin.toString(),
        })
    )
}

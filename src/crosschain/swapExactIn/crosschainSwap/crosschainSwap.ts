import { SwapExactInParams, SwapExactInResult } from '../../types.ts'
import { bestPoolSwapping } from './bestPoolSwapping.ts'

export async function crosschainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    return bestPoolSwapping(params)
}

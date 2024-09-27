import { SwapExactInParams, SwapExactInResult } from '../../types'
import { bestPoolSwapping } from './bestPoolSwapping'

export async function crosschainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    return bestPoolSwapping(params)
}

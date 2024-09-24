import { SwapExactInParams, SwapExactInResult } from '../types'

export async function crosschainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis } = params
    const bestPoolSwapping = symbiosis.bestPoolSwapping()

    return bestPoolSwapping.exactIn(params)
}

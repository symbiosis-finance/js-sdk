import { aggregatorsSwap } from './aggregatorsSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'
import { magpieSwap } from './magpieSwap'
import { theBestOutput } from './utils'
import { isOctoPoolSwapSupported, octoPoolSwap } from './octoPoolSwap'

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const promises: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    if (MagpieTrade.isAvailable(params.tokenAmountIn.token.chainId)) {
        promises.push(magpieSwap(params))
    }
    if (isOctoPoolSwapSupported(params)) {
        promises.push(octoPoolSwap(params))
    }

    return theBestOutput(promises)
}

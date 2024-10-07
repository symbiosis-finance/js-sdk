import { aggregatorsSwap } from './aggregatorsSwap'
import { isOKXSwapSupported, okxSwap } from './okxSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'
import { magpieSwap } from './magpieSwap'
import { theBestOutput } from './utils'

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const promises: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    if (isOKXSwapSupported(params)) {
        promises.push(okxSwap(params))
    }
    if (MagpieTrade.isAvailable(params.tokenAmountIn.token.chainId)) {
        promises.push(magpieSwap(params))
    }

    return theBestOutput(promises)
}

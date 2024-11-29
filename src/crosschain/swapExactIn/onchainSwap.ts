import { aggregatorsSwap } from './aggregatorsSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { MagpieTrade } from '../trade/magpieTrade'
import { magpieSwap } from './magpieSwap'
import { theBest } from './utils'

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis } = params

    const promises: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    if (MagpieTrade.isAvailable(params.tokenAmountIn.token.chainId)) {
        promises.push(magpieSwap(params))
    }

    return theBest(promises, symbiosis.selectMode)
}

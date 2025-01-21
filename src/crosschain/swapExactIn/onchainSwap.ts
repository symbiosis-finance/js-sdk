import { aggregatorsSwap } from './aggregatorsSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
// import { MagpieTrade } from '../trade/magpieTrade'
// import { magpieSwap } from './magpieSwap'
import { theBest } from './utils'
import { isOctoPoolSwapSupported, octoPoolSwap } from './octoPoolSwap'
import { isRadiumSwapSupported, radiumSwap } from './radiumSwap'

export function isOnchainSwapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = params

    return tokenAmountIn.token.chainId === tokenOut.chainId
}

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode } = params

    const promises: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    // if (MagpieTrade.isAvailable(params.tokenAmountIn.token.chainId)) {
    //     promises.push(magpieSwap(params))
    // }
    if (isOctoPoolSwapSupported(params)) {
        promises.push(octoPoolSwap(params))
    }

    if (isRadiumSwapSupported(params)) {
        promises.push(radiumSwap(params))
    }

    return theBest(promises, selectMode)
}

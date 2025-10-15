import { aggregatorsSwap } from './aggregatorsSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { theBest } from './utils'
import { isOctoPoolSwapSupported, octoPoolSwap } from './octoPoolSwap'
import { dedustSwap, isDedustSwapSupported } from './dedustSwap'
import { isStonfiSwapSupported, stonfiSwap } from './stonfiSwap'
import { isOnChainSolanaSwapSupported, onChainSolanaSwap } from './onChainSolanaSwap'

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

    if (isOnChainSolanaSwapSupported(params)) {
        promises.push(...onChainSolanaSwap(params))
    }

    if (isStonfiSwapSupported(params)) {
        promises.push(stonfiSwap(params))
    }

    if (isDedustSwapSupported(params)) {
        promises.push(dedustSwap(params))
    }

    return theBest(promises, selectMode)
}

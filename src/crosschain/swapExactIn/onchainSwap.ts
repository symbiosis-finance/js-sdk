import { SymbiosisTradeType } from '../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { aggregatorsSwap } from './aggregatorsSwap'
import { dedustSwap, isDedustSwapSupported } from './dedustSwap'
import { isOctoPoolSwapSupported, octoPoolSwap } from './octoPoolSwap'
import { isOnChainSolanaSwapSupported, onChainSolanaSwap } from './onChainSolanaSwap'
import { isStonfiSwapSupported, stonfiSwap } from './stonfiSwap'
import { theBest } from './utils'

export function isOnchainSwapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut } = params

    return tokenAmountIn.token.chainId === tokenOut.chainId
}

export async function onchainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode, disabledProviders } = params

    const promises: Promise<SwapExactInResult>[] = [aggregatorsSwap(params)]

    if (isOctoPoolSwapSupported(params) && !disabledProviders?.includes(SymbiosisTradeType.OCTOPOOL)) {
        promises.push(octoPoolSwap(params))
    }

    if (isOnChainSolanaSwapSupported(params)) {
        promises.push(...onChainSolanaSwap(params))
    }

    if (isStonfiSwapSupported(params) && !disabledProviders?.includes(SymbiosisTradeType.STONFI)) {
        promises.push(stonfiSwap(params))
    }

    if (isDedustSwapSupported(params) && !disabledProviders?.includes(SymbiosisTradeType.DEDUST)) {
        promises.push(dedustSwap(params))
    }

    return theBest(promises, selectMode)
}

import { SwappingToTon } from '../swapping'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { theBest } from './utils'

function symbiosisBridgeToTon(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    const { symbiosis, tokenAmountIn, tokenOut, disableSrcChainRouting, disableDstChainRouting } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.omniPools.forEach((poolConfig) => {
        const combinations = symbiosis.getTransitCombinations({
            poolConfig,
            tokenIn: tokenAmountIn.token,
            tokenOut,
            disableSrcChainRouting,
            disableDstChainRouting,
        })
        const poolPromises = combinations.map(({ transitTokenIn, transitTokenOut }) => {
            const swappingToTon = new SwappingToTon(symbiosis, poolConfig)
            return swappingToTon.exactIn({ ...context, transitTokenIn, transitTokenOut })
        })
        promises.push(...poolPromises)
    })

    return promises
}

export async function toTonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode } = context
    return theBest(symbiosisBridgeToTon(context), selectMode)
}

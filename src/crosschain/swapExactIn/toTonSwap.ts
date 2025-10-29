import { SwapExactInParams, SwapExactInResult } from '../types'
import { theBest } from './utils'
import { SwappingToTon } from '../swapping'

// Symbiosis bridge
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

    const promises = []

    promises.push(...symbiosisBridgeToTon(context))

    return theBest(promises, selectMode)
}

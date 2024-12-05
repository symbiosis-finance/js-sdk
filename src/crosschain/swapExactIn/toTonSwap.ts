import { SwapExactInParams, SwapExactInResult } from '../types'
import { theBest } from './utils'
import { SwappingToTon } from '../swapping'

// Symbiosis bridge
function symbiosisBridgeToTon(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    const { symbiosis, tokenAmountIn, tokenOut } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.omniPools.forEach((poolConfig) => {
        const combinations = symbiosis.getTransitCombinations(tokenAmountIn.token.chainId, tokenOut.chainId, poolConfig)
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
    // if (tokenOut.equals(GAS_TOKEN[tokenOut.chainId])) {
    //     promises.push(...nativeBridgeToTon(context))
    // }
    promises.push(...symbiosisBridgeToTon(context))

    return theBest(promises, selectMode)
}

import { SwapExactInParams, SwapExactInResult } from '../types'
import { GAS_TOKEN } from '../../entities'
import { theBestOutput } from './utils'
import { SwappingToTon } from '../swappingToTon'
import { NATIVE_TON_BRIDGE_OPTIONS } from '../chainUtils'
import { ZappingTon } from '../zappingTon'

// TON native bridge
function nativeBridgeToTon(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline } = context

    const options = NATIVE_TON_BRIDGE_OPTIONS.filter((i) => {
        return symbiosis.config.chains.map((chain) => chain.id).find((chainId) => chainId === i.chainId)
    })

    if (options.length === 0) {
        console.log(`Native bridge is not supported from this chain`)
    }

    const promises: Promise<SwapExactInResult>[] = []
    symbiosis.config.omniPools
        .filter((pool) => pool.generalPurpose)
        .forEach((pool) => {
            options.forEach((option) => {
                const zappingTon = new ZappingTon(symbiosis, pool)
                const promise = zappingTon.exactIn({
                    tokenAmountIn,
                    option,
                    from,
                    to,
                    slippage,
                    deadline,
                })
                promises.push(promise)
            })
        })

    return promises
}

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
    const { tokenOut } = context

    const promises = []
    if (tokenOut.equals(GAS_TOKEN[tokenOut.chainId])) {
        promises.push(...nativeBridgeToTon(context))
    }
    promises.push(...symbiosisBridgeToTon(context))

    return theBestOutput(promises)
}

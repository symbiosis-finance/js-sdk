import { withSyncSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { THOR_TOKENS_IN } from './utils'
import { ZappingThor } from './zappingCrossChainThor'
import { zappingOnChainThor } from './zappingOnChainThor'

export function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withSyncSpan('thorChainSwap', {}, () => {
        const { tokenAmountIn, symbiosis } = context
        const thorTokenOut = 'BTC.BTC'

        const promises: Promise<SwapExactInResult>[] = []

        // On-chain zapping: if a user is on the same chain as a ThorChain connector,
        // deposit directly to ThorChain vault without cross-chain bridging
        const onChainThorTokens = THOR_TOKENS_IN.filter((t) => t.chainId === tokenAmountIn.token.chainId)
        if (onChainThorTokens.length > 0) {
            const onChainPromises = onChainThorTokens.map((thorTokenIn) =>
                zappingOnChainThor(context, thorTokenIn, thorTokenOut)
            )
            promises.push(...onChainPromises)
        }

        // DO NOT add cross-chain routes if there are on-chain ones
        if (promises.length === 0) {
            const usdPoolConfig = symbiosis.config.omniPools.find((pool) => {
                return pool.coinGeckoId === 'usd-coin'
            })
            if (usdPoolConfig) {
                // Cross-chain zapping: bridge to the connector chain, then deposit to ThorChain
                const crossChainPromises = THOR_TOKENS_IN.map((thorTokenIn) => {
                    const zappingThor = new ZappingThor(symbiosis, usdPoolConfig)
                    return zappingThor.exactIn(context, thorTokenIn, thorTokenOut)
                })
                promises.push(...crossChainPromises)
            }
        }
        return promises
    })
}

import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { theBest } from '../utils'
import { THOR_TOKENS_IN } from './utils'
import { ZappingThor } from './zappingCrossChainThor'
import { zappingOnChainThor } from './zappingOnChainThor'

export async function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, partnerAddress, fallbackReceiver } =
        context
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

    const usdPoolConfig = symbiosis.config.omniPools.find((pool) => {
        return pool.coinGeckoId === 'usd-coin'
    })
    if (usdPoolConfig) {
        // Cross-chain zapping: bridge to the connector chain, then deposit to ThorChain
        const crossChainPromises = THOR_TOKENS_IN.map((thorTokenIn) => {
            const zappingThor = new ZappingThor(symbiosis, usdPoolConfig)

            return zappingThor.exactIn({
                tokenAmountIn,
                thorTokenIn,
                thorTokenOut,
                from,
                to,
                slippage,
                deadline,
                partnerAddress,
                fallbackReceiver,
            })
        })
        promises.push(...crossChainPromises)
    }

    return theBest(promises, selectMode)
}

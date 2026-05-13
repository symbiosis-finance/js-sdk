import { withPromisesSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { getThorChainDestination, THORCHAIN_TOKENS_EVM_TRANSIT } from './constants'
import { ZappingThor } from './zappingCrossChainThor'
import { zappingOnChainThor } from './zappingOnChainThor'

export function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('thorChainSwap', {}, () => {
        const { tokenAmountIn, tokenOut, symbiosis } = context
        const destination = getThorChainDestination(tokenOut)

        const promises: Promise<SwapExactInResult>[] = []

        // On-chain zap: source holds a Thor connector USDC on the same EVM chain.
        const onChainThorTokens = THORCHAIN_TOKENS_EVM_TRANSIT.filter((t) => t.chainId === tokenAmountIn.token.chainId)
        if (onChainThorTokens.length > 0) {
            promises.push(
                ...onChainThorTokens.map((thorTokenIn) => zappingOnChainThor(context, thorTokenIn, destination))
            )
        }

        // Cross-chain zap via Symbiosis transit to a connector chain.
        if (promises.length === 0) {
            const usdPoolConfig = symbiosis.config.omniPools.find((pool) => pool.coinGeckoId === 'usd-coin')
            if (usdPoolConfig) {
                promises.push(
                    ...THORCHAIN_TOKENS_EVM_TRANSIT.map((thorTokenIn) => {
                        const zappingThor = new ZappingThor(symbiosis, usdPoolConfig)
                        return zappingThor.exactIn(context, thorTokenIn, destination)
                    })
                )
            }
        }

        return promises
    })
}

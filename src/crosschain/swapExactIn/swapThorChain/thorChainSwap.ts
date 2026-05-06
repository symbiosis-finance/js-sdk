import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { theBest } from '../utils'
import { ZappingCrossChainThorChain } from './zappingCrossChainThorChain'
import { ZappingOnChainThorChain } from './zappingOnChainThorChain'
import { ThorChainError } from '../../sdkError'
import {
    getThorChainDestination,
    isThorChainNativeSourceChainId,
    THORCHAIN_TOKENS_IN,
} from './constants'
import { thorChainDepositSwap } from './thorChainDepositSwap'

export async function thorChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, selectMode } = context
    const destination = getThorChainDestination(tokenOut)

    const promises: Promise<SwapExactInResult>[] = []

    // Deposit flow: source is a ThorChain L1 chain (LTC/BCH/XRP/DOGE) — user broadcasts the
    // L1 transaction manually using the inbound address + memo we return.
    if (isThorChainNativeSourceChainId(tokenAmountIn.token.chainId)) {
        promises.push(thorChainDepositSwap(context))
    }

    // On-chain zapping: if user is on the same EVM chain as a ThorChain connector token,
    // deposit directly to ThorChain vault without cross-chain bridging.
    const onChainThorTokens = THORCHAIN_TOKENS_IN.filter((t) => t.chainId === tokenAmountIn.token.chainId)
    if (onChainThorTokens.length > 0) {
        const onChainPromises = onChainThorTokens.map((thorTokenIn) =>
            ZappingOnChainThorChain(context, thorTokenIn, destination)
        )
        promises.push(...onChainPromises)
    }

    if (promises.length === 0) {
        const usdPoolConfig = symbiosis.config.omniPools.find((pool) => pool.coinGeckoId === 'usd-coin')
        if (usdPoolConfig) {
            // Cross-chain zapping: bridge to the connector chain, then deposit to ThorChain
            const crossChainPromises = THORCHAIN_TOKENS_IN.map((thorTokenIn) => {
                const zapping = new ZappingCrossChainThorChain(symbiosis, usdPoolConfig)
                return zapping.exactIn(context, thorTokenIn, destination)
            })
            promises.push(...crossChainPromises)
        }
    }
    if (promises.length === 0) {
        throw new ThorChainError(`No ThorChain route found for ${destination.thorAsset}`)
    }

    return theBest(promises, selectMode)
}

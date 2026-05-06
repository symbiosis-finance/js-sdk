import { withPromisesSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import type { ChainFlipConfig } from './types'
import { CF_ARB_USDC, CF_ETH_USDC, CF_SOL_SOL, CF_SOL_USDC } from './utils'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'

const CONFIGS: ChainFlipConfig[] = [
    {
        src: CF_ARB_USDC,
        dst: CF_SOL_SOL,
    },
    {
        src: CF_ARB_USDC,
        dst: CF_SOL_USDC,
    },
    {
        src: CF_ETH_USDC,
        dst: CF_SOL_SOL,
    },
    {
        src: CF_ETH_USDC,
        dst: CF_SOL_USDC,
    },
]

export const CHAIN_FLIP_TO_SOLANA_TOKENS_IN = CONFIGS.map((i) => i.src.token)

export function solanaChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('solanaChainFlipSwap', {}, () => {
        const { tokenAmountIn, from, to, symbiosis, slippage, deadline, tokenOut } = context

        const CF_CONFIGS = CONFIGS.filter((config) => config.dst.token.equals(tokenOut))
        if (!CF_CONFIGS.length) {
            return []
        }

        const promises: Promise<SwapExactInResult>[] = []

        const onChainConfigs = CF_CONFIGS.filter((config) => config.src.token.chainId === tokenAmountIn.token.chainId)
        promises.push(...onChainConfigs.map((config) => ZappingOnChainChainFlip(context, config)))

        if (promises.length === 0) {
            const usdPoolConfig = symbiosis.config.omniPools.find((pool) => {
                return pool.coinGeckoId === 'usd-coin'
            })
            if (usdPoolConfig) {
                const crossChainPromises = CF_CONFIGS.map((config) => {
                    const zapping = new ZappingCrossChainChainFlip(context, usdPoolConfig)
                    return zapping.exactIn({
                        tokenAmountIn,
                        config,
                        from,
                        to,
                        slippage,
                        deadline,
                    })
                })

                promises.push(...crossChainPromises)
            }
        }

        return promises
    })
}

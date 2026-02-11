import { ChainId } from '../../../constants'
import { GAS_TOKEN } from '../../../entities'
import { ChainFlipError } from '../../sdkError'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { theBest } from '../utils'
import type { ChainFlipConfig, ChainFlipToken } from './types'
import { ChainFlipAssetId, ChainFlipChainId } from './types'
import { ARB_USDC, CF_ARB_USDC, CF_ETH_USDC, ETH_USDC } from './utils'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'

const CF_BTC_BTC: ChainFlipToken = {
    chainId: ChainFlipChainId.Bitcoin,
    assetId: ChainFlipAssetId.BTC,
    chain: 'Bitcoin',
    asset: 'BTC',
}

const CONFIGS: ChainFlipConfig[] = [
    {
        tokenIn: ARB_USDC,
        tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_BTC_BTC,
    },
    {
        tokenIn: ETH_USDC,
        tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
        src: CF_ETH_USDC,
        dest: CF_BTC_BTC,
    },
]

export const CHAIN_FLIP_BTC_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function btcChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, tokenOut } = context

    const poolConfig = symbiosis.config.omniPools.find((pool) => {
        return pool.coinGeckoId === 'usd-coin'
    })
    if (!poolConfig) {
        throw new ChainFlipError('No USD pool found')
    }

    const CF_CONFIGS = CONFIGS.filter((config) => config.tokenOut.equals(tokenOut))
    if (!CF_CONFIGS.length) {
        throw new ChainFlipError('No config found for tokenOut')
    }

    const promises: Promise<SwapExactInResult>[] = []

    if (CF_CONFIGS.some((config) => config.tokenIn.chainId === tokenAmountIn.token.chainId)) {
        const onChainPromises = CF_CONFIGS.map((config) => ZappingOnChainChainFlip(context, config))
        promises.push(...onChainPromises)
    }

    const crossChainPromises = CF_CONFIGS.map((config) => {
        const zapping = new ZappingCrossChainChainFlip(context, poolConfig)
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

    return theBest(promises, selectMode)
}

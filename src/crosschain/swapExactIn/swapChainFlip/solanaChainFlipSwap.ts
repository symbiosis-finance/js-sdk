import { ChainId } from '../../../constants'
import { GAS_TOKEN } from '../../../entities'
import { SOL_USDC } from '../../chainUtils'
import { ChainFlipError } from '../../sdkError'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { theBest } from '../utils'
import type { ChainFlipConfig, ChainFlipToken } from './types'
import { ChainFlipAssetId, ChainFlipChainId } from './types'
import { ARB_USDC, CF_ARB_USDC, CF_ETH_USDC, ETH_USDC } from './utils'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'

const CF_SOL_SOL: ChainFlipToken = {
    chainId: ChainFlipChainId.Solana,
    assetId: ChainFlipAssetId.SOL,
    chain: 'Solana',
    asset: 'SOL',
}

const CF_SOL_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Solana,
    assetId: ChainFlipAssetId.solUSDC,
    chain: 'Solana',
    asset: 'USDC',
}

const CONFIGS: ChainFlipConfig[] = [
    {
        tokenIn: ARB_USDC,
        tokenOut: GAS_TOKEN[ChainId.SOLANA_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_SOL_SOL,
    },
    {
        tokenIn: ARB_USDC,
        tokenOut: SOL_USDC,
        src: CF_ARB_USDC,
        dest: CF_SOL_USDC,
    },
    {
        tokenIn: ETH_USDC,
        tokenOut: GAS_TOKEN[ChainId.SOLANA_MAINNET],
        src: CF_ETH_USDC,
        dest: CF_SOL_SOL,
    },
    {
        tokenIn: ETH_USDC,
        tokenOut: SOL_USDC,
        src: CF_ETH_USDC,
        dest: CF_SOL_USDC,
    },
]

export const CHAIN_FLIP_SOL_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function solanaChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
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

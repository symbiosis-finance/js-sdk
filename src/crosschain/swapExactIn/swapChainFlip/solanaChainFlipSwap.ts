import { SwapExactInParams, SwapExactInResult } from '../../types.ts'
import { ChainFlipAssetId, ChainFlipChainId, ChainFlipConfig, ChainFlipToken } from './types.ts'
import { GAS_TOKEN } from '../../../entities/index.ts'
import { ChainId } from '../../../constants.ts'
import { theBest } from '../utils.ts'
import { SOL_USDC } from '../../chainUtils/index.ts'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip.ts'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip.ts'
import { ARB_USDC, CF_ARB_USDC, CF_ETH_USDC, ETH_USDC } from './utils.ts'
import { ChainFlipError } from '../../sdkError.ts'

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

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

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

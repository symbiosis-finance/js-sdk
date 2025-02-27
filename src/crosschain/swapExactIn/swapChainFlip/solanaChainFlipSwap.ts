import { SwapExactInParams, SwapExactInResult } from '../../types'
import { ChainFlipAssetId, ChainFlipChainId, ChainFlipConfig, ChainFlipToken } from './types'
import { GAS_TOKEN } from '../../../entities'
import { ChainId } from '../../../constants'
import { theBest } from '../utils'
import { SOL_USDC } from '../../chainUtils'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ARB_USDC } from './utils'

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

const CF_ARB_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Arbitrum,
    assetId: ChainFlipAssetId.USDC,
    chain: 'Arbitrum',
    asset: 'USDC',
}

const CONFIGS: ChainFlipConfig[] = [
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920',
        tokenIn: ARB_USDC,
        tokenOut: GAS_TOKEN[ChainId.SOLANA_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_SOL_SOL,
    },
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920',
        tokenIn: ARB_USDC,
        tokenOut: SOL_USDC,
        src: CF_ARB_USDC,
        dest: CF_SOL_USDC,
    },
]

export const CHAIN_FLIP_SOL_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function solanaChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, tokenOut } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const CF_CONFIG = CONFIGS.find((config) => config.tokenOut.equals(tokenOut))

    if (!CF_CONFIG) {
        throw new Error('ChainFlipSwap: No config found for tokenOut')
    }

    if (CF_CONFIG.tokenIn.chainId === tokenAmountIn.token.chainId) {
        return ZappingOnChainChainFlip(context, CF_CONFIG)
    }

    const zappingChainFlip = new ZappingCrossChainChainFlip(context, poolConfig)

    const promise = zappingChainFlip.exactIn({
        tokenAmountIn,
        config: CF_CONFIG,
        from,
        to,
        slippage,
        deadline,
    })

    return theBest([promise], selectMode)
}

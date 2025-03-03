import { SwapExactInParams, SwapExactInResult } from '../../types'
import { ChainFlipAssetId, ChainFlipChainId, ChainFlipConfig, ChainFlipToken } from './types'
import { GAS_TOKEN } from '../../../entities'
import { ChainId } from '../../../constants'
import { theBest } from '../utils'
import { SOL_USDC } from '../../chainUtils'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'
import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ARB_USDC, ETH_USDC } from './utils'

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

const CF_ETH_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Ethereum,
    assetId: ChainFlipAssetId.USDC,
    chain: 'Ethereum',
    asset: 'USDC',
}

const CONFIGS: ChainFlipConfig[] = [
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920', // ARB
        tokenIn: ARB_USDC,
        tokenOut: GAS_TOKEN[ChainId.SOLANA_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_SOL_SOL,
    },
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920', // ARB
        tokenIn: ARB_USDC,
        tokenOut: SOL_USDC,
        src: CF_ARB_USDC,
        dest: CF_SOL_USDC,
    },
    {
        vaultAddress: '0xF5e10380213880111522dd0efD3dbb45b9f62Bcc', // ETH
        tokenIn: ETH_USDC,
        tokenOut: GAS_TOKEN[ChainId.SOLANA_MAINNET],
        src: CF_ETH_USDC,
        dest: CF_SOL_SOL,
    },
    {
        vaultAddress: '0xF5e10380213880111522dd0efD3dbb45b9f62Bcc', // ETH
        tokenIn: ETH_USDC,
        tokenOut: SOL_USDC,
        src: CF_ETH_USDC,
        dest: CF_SOL_USDC,
    },
]

export const CHAIN_FLIP_SOL_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function solanaChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, tokenOut } = context
    console.log('tokenOut', tokenOut)

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    console.log('poolConfig', poolConfig)

    const CF_CONFIGS = CONFIGS.filter((config) => config.tokenOut.equals(tokenOut))

    console.log('CF_CONFIG', CF_CONFIGS)

    if (!CF_CONFIGS.length) {
        throw new Error('ChainFlipSwap: No config found for tokenOut')
    }

    if (CF_CONFIGS.some((config) => config.tokenIn.chainId === tokenAmountIn.token.chainId)) {
        const promises = CF_CONFIGS.map((config) => ZappingOnChainChainFlip(context, config))

        return theBest(promises, selectMode)
    }

    const zappingChainFlip = new ZappingCrossChainChainFlip(context, poolConfig)

    const promises = CF_CONFIGS.map((config) =>
        zappingChainFlip.exactIn({
            tokenAmountIn,
            config,
            from,
            to,
            slippage,
            deadline,
        })
    )

    return theBest(promises, selectMode)
}

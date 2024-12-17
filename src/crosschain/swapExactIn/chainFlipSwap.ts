import { SwapExactInParams, SwapExactInResult } from '../types'
import {
    ChainFlipAssetId,
    ChainFlipChainId,
    ChainFlipConfig,
    ChainFlipToken,
    ZappingChainFlip,
} from '../swapping/zappingChainFlip'
import { GAS_TOKEN, Token } from '../../entities'
import { ChainId } from '../../constants'
import { theBest } from './utils'

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

const ARB_USDC = new Token({
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: ChainId.ARBITRUM_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const SOL_USDC = new Token({
    name: 'USDC',
    symbol: 'USDC',
    address: '0x0000000000000000000000000000000000000003', // according to ChainFlipAssetId
    chainId: ChainId.SOLANA_MAINNET,
    decimals: 6,
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/3408.png',
    },
})

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

export const CHAIN_FLIP_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function chainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, tokenOut } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const CF_CONFIG = CONFIGS.find((config) => config.tokenOut.equals(tokenOut))

    if (!CF_CONFIG) {
        throw new Error('ChainFlipSwap: No config found for tokenOut')
    }

    const zappingChainFlip = new ZappingChainFlip(symbiosis, poolConfig)

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

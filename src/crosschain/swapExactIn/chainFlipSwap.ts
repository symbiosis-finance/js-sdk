import { SwapExactInParams, SwapExactInResult } from '../types'
import { theBest } from './utils'
import {
    ChainFlipAssetId,
    ChainFlipChainId,
    ChainFlipConfig,
    ChainFlipToken,
    ZappingChainFlip,
} from '../swapping/zappingChainFlip'
import { Token } from '../../entities'
import { ChainId } from '../../constants'

const SOL: ChainFlipToken = {
    chainId: ChainFlipChainId.Solana,
    assetId: ChainFlipAssetId.SOL,
    chain: 'Solana',
    asset: 'SOL',
}
const USDC: ChainFlipToken = {
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

const CONFIGS: ChainFlipConfig[] = [
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920',
        tokenIn: ARB_USDC,
        src: USDC,
        dest: SOL,
    },
]

export const CHAIN_FLIP_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function chainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const promises = CONFIGS.map((config) => {
        const zappingChainFlip = new ZappingChainFlip(symbiosis, poolConfig)

        return zappingChainFlip.exactIn({
            tokenAmountIn,
            config,
            from,
            to,
            slippage,
            deadline,
        })
    })

    return theBest(promises, selectMode)
}

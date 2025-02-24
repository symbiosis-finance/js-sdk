import { SwapExactInParams, SwapExactInResult } from '../../types'
import { GAS_TOKEN } from '../../../entities'
import { ChainId } from '../../../constants'
import { theBest } from '../utils'

import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'
import { ChainFlipAssetId, ChainFlipConfig, ChainFlipChainId, ChainFlipToken } from './types'
import { ARB_USDC } from './utils'

const CF_BTC_BTC: ChainFlipToken = {
    chainId: ChainFlipChainId.Bitcoin,
    assetId: ChainFlipAssetId.BTC,
    chain: 'Bitcoin',
    asset: 'BTC',
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
        tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_BTC_BTC,
    },
]

export const CHAIN_FLIP_BTC_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function btcChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
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

    const zappingChainFlip = new ZappingCrossChainChainFlip(symbiosis, poolConfig)

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

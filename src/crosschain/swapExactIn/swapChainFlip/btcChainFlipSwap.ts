import { SwapExactInParams, SwapExactInResult } from '../../types'
import { GAS_TOKEN } from '../../../entities'
import { ChainId } from '../../../constants'
import { theBest } from '../utils'

import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip'
import { ChainFlipAssetId, ChainFlipConfig, ChainFlipChainId, ChainFlipToken } from './types'
import { ARB_USDC, CF_ARB_USDC, CF_ETH_USDC, ETH_USDC } from './utils'

const CF_BTC_BTC: ChainFlipToken = {
    chainId: ChainFlipChainId.Bitcoin,
    assetId: ChainFlipAssetId.BTC,
    chain: 'Bitcoin',
    asset: 'BTC',
}

const CONFIGS: ChainFlipConfig[] = [
    {
        vaultAddress: '0x79001a5e762f3befc8e5871b42f6734e00498920',
        tokenIn: ARB_USDC,
        tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
        src: CF_ARB_USDC,
        dest: CF_BTC_BTC,
    },
    {
        vaultAddress: '0xF5e10380213880111522dd0efD3dbb45b9f62Bcc',
        tokenIn: ETH_USDC,
        tokenOut: GAS_TOKEN[ChainId.BTC_MAINNET],
        src: CF_ETH_USDC,
        dest: CF_BTC_BTC,
    },
]

export const CHAIN_FLIP_BTC_TOKENS = CONFIGS.map((i) => i.tokenIn)

export async function btcChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis, slippage, deadline, selectMode, tokenOut } = context

    // via stable pool only
    const poolConfig = symbiosis.config.omniPools[0]

    const CF_CONFIGS = CONFIGS.filter((config) => config.tokenOut.equals(tokenOut))

    if (!CF_CONFIGS.length) {
        throw new Error('ChainFlipSwap: No config found for tokenOut')
    }

    const promises: Promise<SwapExactInResult>[] = []

    if (CF_CONFIGS.some((config) => config.tokenIn.chainId === tokenAmountIn.token.chainId)) {
        const onChainPromises = CF_CONFIGS.map((config) => ZappingOnChainChainFlip(context, config))
        promises.push(...onChainPromises)
    }

    const zappingChainFlip = new ZappingCrossChainChainFlip(context, poolConfig)

    const crossChainPromises = CF_CONFIGS.map((config) =>
        zappingChainFlip.exactIn({
            tokenAmountIn,
            config,
            from,
            to,
            slippage,
            deadline,
        })
    )

    promises.push(...crossChainPromises)

    return theBest(promises, selectMode)
}

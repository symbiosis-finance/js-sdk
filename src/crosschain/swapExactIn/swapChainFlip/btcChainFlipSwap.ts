import { SwapExactInParams, SwapExactInResult } from '../../types.ts'
import { GAS_TOKEN } from '../../../entities/index.ts'
import { ChainId } from '../../../constants.ts'
import { theBest } from '../utils.ts'

import { ZappingCrossChainChainFlip } from './zappingCrossChainChainFlip.ts'
import { ZappingOnChainChainFlip } from './zappingOnChainChainFlip.ts'
import { ChainFlipAssetId, ChainFlipChainId, ChainFlipConfig, ChainFlipToken } from './types.ts'
import { ARB_USDC, CF_ARB_USDC, CF_ETH_USDC, ETH_USDC } from './utils.ts'

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

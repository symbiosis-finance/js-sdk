import type { Quote, SwapSDK } from '@chainflip/sdk/swap'

import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../../entities'
import type { Cache } from '../../cache'
import { ChainFlipError } from '../../sdkError'
import type { ChainFlipToken } from './types'
import { ChainFlipAssetId, ChainFlipChainId } from './types'
import { SOL_USDC } from '../../chainUtils'

export const ChainFlipBrokerAccount = 'cFJZvt5AiEGwUiFFNxhDuLRcgC1WBR6tE7gaQQfe8dqbzoYkx'
export const ChainFlipBrokerFeeBps = 20

export const ARB_USDC = new Token({
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

export const ETH_USDC = new Token({
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const CF_BTC_BTC: ChainFlipToken = {
    chainId: ChainFlipChainId.Bitcoin,
    assetId: ChainFlipAssetId.BTC,
    chain: 'Bitcoin',
    asset: 'BTC',
    token: GAS_TOKEN[ChainId.BTC_MAINNET],
}

export const CF_ETH_ETH: ChainFlipToken = {
    chainId: ChainFlipChainId.Ethereum,
    assetId: ChainFlipAssetId.ETH,
    chain: 'Ethereum',
    asset: 'ETH',
    token: GAS_TOKEN[ChainId.ETH_MAINNET],
}

export const CF_ETH_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Ethereum,
    assetId: ChainFlipAssetId.USDC,
    chain: 'Ethereum',
    asset: 'USDC',
    token: ETH_USDC,
}

export const CF_ARB_ETH: ChainFlipToken = {
    chainId: ChainFlipChainId.Arbitrum,
    assetId: ChainFlipAssetId.arbETH,
    chain: 'Arbitrum',
    asset: 'ETH',
    token: GAS_TOKEN[ChainId.ARBITRUM_MAINNET],
}

export const CF_ARB_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Arbitrum,
    assetId: ChainFlipAssetId.arbUSDC,
    chain: 'Arbitrum',
    asset: 'USDC',
    token: ARB_USDC,
}

export const CF_SOL_SOL: ChainFlipToken = {
    chainId: ChainFlipChainId.Solana,
    assetId: ChainFlipAssetId.SOL,
    chain: 'Solana',
    asset: 'SOL',
    token: GAS_TOKEN[ChainId.SOLANA_MAINNET],
}

export const CF_SOL_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Solana,
    assetId: ChainFlipAssetId.solUSDC,
    chain: 'Solana',
    asset: 'USDC',
    token: SOL_USDC,
}

export async function checkMinAmount(cache: Cache, chainFlipSdk: SwapSDK, amountIn: TokenAmount) {
    const swapLimits = await cache.get(['chainFlip', 'getSwapLimits'], () => chainFlipSdk.getSwapLimits(), 24 * 60 * 60) // 24 hours

    let minThreshold: TokenAmount | undefined = undefined
    let maxThreshold: TokenAmount | undefined = undefined
    if (amountIn.token.equals(ARB_USDC)) {
        minThreshold = new TokenAmount(ARB_USDC, swapLimits.minimumSwapAmounts.Arbitrum.USDC.toString())
        const max = swapLimits.maximumSwapAmounts.Arbitrum.USDC
        if (max) {
            maxThreshold = new TokenAmount(ARB_USDC, max.toString())
        }
    } else if (amountIn.token.equals(ETH_USDC)) {
        minThreshold = new TokenAmount(ETH_USDC, swapLimits.minimumSwapAmounts.Ethereum.USDC.toString())
        const max = swapLimits.maximumSwapAmounts.Ethereum.USDC
        if (max) {
            maxThreshold = new TokenAmount(ETH_USDC, max.toString())
        }
    } else if (amountIn.token.chainId === ChainId.SOLANA_MAINNET && amountIn.token.isNative) {
        const SOL = GAS_TOKEN[ChainId.SOLANA_MAINNET]
        minThreshold = new TokenAmount(SOL, swapLimits.minimumSwapAmounts.Solana.SOL.toString())
        const max = swapLimits.maximumSwapAmounts.Solana.SOL
        if (max) {
            maxThreshold = new TokenAmount(SOL, max.toString())
        }
    } else if (amountIn.token.chainId === ChainId.SOLANA_MAINNET && !amountIn.token.isNative) {
        // SOL USDC
        const SOL_USDC_TOKEN = amountIn.token
        minThreshold = new TokenAmount(SOL_USDC_TOKEN, swapLimits.minimumSwapAmounts.Solana.USDC.toString())
        const max = swapLimits.maximumSwapAmounts.Solana.USDC
        if (max) {
            maxThreshold = new TokenAmount(SOL_USDC_TOKEN, max.toString())
        }
    }

    if (minThreshold && amountIn.lessThan(minThreshold)) {
        throw new ChainFlipError(
            `Amount should be greater than ${minThreshold.toSignificant()} ${minThreshold.token.symbol}`
        )
    }
    if (maxThreshold && amountIn.greaterThan(maxThreshold)) {
        throw new ChainFlipError(
            `Amount should be less than ${maxThreshold.toSignificant()} ${maxThreshold.token.symbol}`
        )
    }
}

export function getChainFlipFee(quote: Quote) {
    const SOL = GAS_TOKEN[ChainId.SOLANA_MAINNET]
    const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

    let usdcFee = 0
    let solFee = 0
    let btcFee = 0

    quote.includedFees.forEach(({ asset, amount }) => {
        if (asset === 'USDC') {
            usdcFee += parseInt(amount)
        }
        if (asset === 'SOL') {
            solFee += parseInt(amount)
        }
        if (asset === 'BTC') {
            btcFee += parseInt(amount)
        }
    })

    return {
        usdcFeeToken: new TokenAmount(ARB_USDC, usdcFee.toString()),
        solFeeToken: new TokenAmount(SOL, solFee.toString()),
        btcFeeToken: new TokenAmount(BTC, btcFee.toString()),
    }
}

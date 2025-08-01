import { Quote } from '@chainflip/sdk/swap'

import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../../entities'
import { ChainFlipAssetId, ChainFlipChainId, ChainFlipToken } from './types'

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

export const CF_ARB_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Arbitrum,
    assetId: ChainFlipAssetId.USDC,
    chain: 'Arbitrum',
    asset: 'USDC',
}

export const CF_ETH_USDC: ChainFlipToken = {
    chainId: ChainFlipChainId.Ethereum,
    assetId: ChainFlipAssetId.USDC,
    chain: 'Ethereum',
    asset: 'USDC',
}

export function checkMinAmount(amountIn: TokenAmount) {
    let minThreshold: TokenAmount | undefined = undefined
    if (amountIn.token.equals(ARB_USDC)) {
        minThreshold = new TokenAmount(ARB_USDC, '15000000') //  15 USDC
    } else if (amountIn.token.equals(ETH_USDC)) {
        minThreshold = new TokenAmount(ARB_USDC, '25000000') //  25 USDC
    }

    if (minThreshold && amountIn.lessThan(minThreshold)) {
        throw new Error(`Amount should be greater than ${minThreshold.toSignificant()} ${minThreshold.token.symbol}`)
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

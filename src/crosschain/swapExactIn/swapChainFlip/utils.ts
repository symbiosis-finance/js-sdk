import { Address, getAddressEncoder } from '@solana/addresses'
import { QuoteResponse } from '@chainflip/sdk/swap'

import { isBtcChainId } from '../../chainUtils/btc'
import { ChainId } from '../../../constants'
import { isSolanaChainId } from '../../chainUtils'
import { GAS_TOKEN, Token, TokenAmount } from '../../../entities'

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

export function getDestinationAddress(address: string, chainId: ChainId) {
    if (isBtcChainId(chainId)) {
        return `0x${Buffer.from(address).toString('hex')}`
    }
    if (isSolanaChainId(chainId)) {
        const encoder = getAddressEncoder()
        return encoder.encode(address as Address)
    }
    throw new Error(`Unknown chain ${chainId}`)
}

export function getChainFlipFee(includedFees: QuoteResponse['quote']['includedFees']) {
    const SOL = GAS_TOKEN[ChainId.SOLANA_MAINNET]
    const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

    let usdcFee = 0
    let solFee = 0
    let btcFee = 0

    includedFees
        .filter((fee) => fee.type === 'EGRESS')
        .forEach(({ asset, amount }) => {
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

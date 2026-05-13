import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token } from '../../../entities'
import { ThorChainError } from '../../sdkError'
import type { ThorChainDestination } from './types'

export const THORCHAIN_DESTINATIONS: ThorChainDestination[] = [
    // Native L1
    { token: GAS_TOKEN[ChainId.BTC_MAINNET], thorAsset: 'BTC.BTC' },
    { token: GAS_TOKEN[ChainId.LTC_MAINNET], thorAsset: 'LTC.LTC', isThorChainOnlyDestination: true },
    { token: GAS_TOKEN[ChainId.BCH_MAINNET], thorAsset: 'BCH.BCH', isThorChainOnlyDestination: true },
    { token: GAS_TOKEN[ChainId.XRP_MAINNET], thorAsset: 'XRP.XRP', isThorChainOnlyDestination: true },
    { token: GAS_TOKEN[ChainId.DOGE_MAINNET], thorAsset: 'DOGE.DOGE', isThorChainOnlyDestination: true },

    // Ethereum
    { token: GAS_TOKEN[ChainId.ETH_MAINNET], thorAsset: 'ETH.ETH' },
    {
        token: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
        }),
        thorAsset: 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48',
        isEvmConnectorToken: true,
    },
    {
        token: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
            symbol: 'USDT',
            name: 'Tether USD',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
            },
        }),
        thorAsset: 'ETH.USDT-0XDAC17F958D2EE523A2206206994597C13D831EC7',
    },
    {
        token: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
            decimals: 8,
            symbol: 'WBTC',
            name: 'Wrapped BTC',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3717.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3717.png',
            },
        }),
        thorAsset: 'ETH.WBTC-0X2260FAC5E5542A773AA44FBCFEDF7C193BC2C599',
    },
    {
        token: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x6b175474e89094c44da98b954eedeac495271d0f',
            decimals: 18,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4943.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4943.png',
            },
        }),
        thorAsset: 'ETH.DAI-0X6B175474E89094C44DA98B954EEDEAC495271D0F',
    },
    {
        token: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x514910771af9ca656af840dff83e8264ecf986ca',
            decimals: 18,
            symbol: 'LINK',
            name: 'Chainlink',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1975.png',
            },
        }),
        thorAsset: 'ETH.LINK-0X514910771AF9CA656AF840DFF83E8264ECF986CA',
    },

    // BSC
    { token: GAS_TOKEN[ChainId.BSC_MAINNET], thorAsset: 'BSC.BNB' },
    {
        token: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            decimals: 18,
            symbol: 'USDC',
            name: 'USD Coin',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
        }),
        thorAsset: 'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
        isEvmConnectorToken: true,
    },
    {
        token: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x55d398326f99059ff775485246999027b3197955',
            decimals: 18,
            symbol: 'USDT',
            name: 'Tether USD',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
            },
        }),
        thorAsset: 'BSC.USDT-0X55D398326F99059FF775485246999027B3197955',
    },
    {
        token: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
            decimals: 18,
            symbol: 'ETH',
            name: 'Ethereum (BEP20)',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
            },
        }),
        thorAsset: 'BSC.ETH-0X2170ED0880AC9A755FD29B2688956BD959F933F8',
    },

    // Avalanche
    { token: GAS_TOKEN[ChainId.AVAX_MAINNET], thorAsset: 'AVAX.AVAX' },
    {
        token: new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
        }),
        thorAsset: 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E',
        isEvmConnectorToken: true,
    },
    {
        token: new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7',
            decimals: 6,
            symbol: 'USDT',
            name: 'Tether USD',
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
            },
        }),
        thorAsset: 'AVAX.USDT-0X9702230A8EA53601F5CD2DC00FDBC13D4DF4A8C7',
    },
]

export const THORCHAIN_TOKENS_EVM_TRANSIT: Token[] = THORCHAIN_DESTINATIONS.filter((d) => d.isEvmConnectorToken).map(
    (d) => d.token
)

// thorChainSwap (LTC/BCH/XRP/DOGE).
export const THORCHAIN_L1_DEST_CHAIN_IDS: ChainId[] = THORCHAIN_DESTINATIONS.filter(
    (d) => d.isThorChainOnlyDestination
).map((d) => d.token.chainId)

export function getThorChainDestination(token: Token): ThorChainDestination {
    const match = THORCHAIN_DESTINATIONS.find((d) => d.token.equals(token))
    if (!match) {
        throw new ThorChainError(`Unsupported THORChain destination: ${token.symbol} on chain ${token.chainId}`)
    }
    return match
}

// True for the L1 subset only (LTC/BCH/XRP/DOGE).
export function isThorChainL1DestChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return THORCHAIN_L1_DEST_CHAIN_IDS.includes(chainId)
}

const THORCHAIN_ANY_DEST_CHAIN_IDS = new Set<ChainId>(THORCHAIN_DESTINATIONS.map((d) => d.token.chainId))

// any chain Thor can deliver to (BTC + L1 + EVM connectors).
export function isThorChainSupportedChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return THORCHAIN_ANY_DEST_CHAIN_IDS.has(chainId)
}

import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token } from '../../../entities'
import { ThorChainError } from '../../sdkError'
import type { ThorChainDestination } from './types'

// Connector tokens used by the on-chain / cross-chain zapping flows AND as deposit-flow
// destinations. Single source of truth — referenced from THORCHAIN_DESTINATIONS below
// and re-exported as THORCHAIN_TOKENS_IN.
export const ETH_USDC = new Token({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const AVAX_USDC = new Token({
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    chainId: ChainId.AVAX_MAINNET,
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const BSC_USDC = new Token({
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    chainId: ChainId.BSC_MAINNET,
    decimals: 18,
    name: 'USD Coin',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const BASE_USDC = new Token({
    address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    chainId: ChainId.BASE_MAINNET,
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const THORCHAIN_TOKENS_IN = [ETH_USDC, AVAX_USDC, BSC_USDC, BASE_USDC]

// Single source of truth for ChainId → THORChain prefix.
// `isNativeL1` flags chains where the SDK builds a deposit-flow (no wallet on source);
// other entries are EVM connector chains used to construct ERC-20 asset strings.
// BTC is intentionally excluded from native-L1 sources: FROM-BTC swaps go through the
// symBtc portal (fromBtcSwap), not THORChain deposit. BTC is still a valid destination.
export const THORCHAIN_CHAIN_MAP: Partial<Record<ChainId, { prefix: string; isNativeL1: boolean }>> = {
    // Native L1 sources / destinations
    [ChainId.BTC_MAINNET]: { prefix: 'BTC', isNativeL1: false },
    [ChainId.LTC_MAINNET]: { prefix: 'LTC', isNativeL1: true },
    [ChainId.BCH_MAINNET]: { prefix: 'BCH', isNativeL1: true },
    [ChainId.XRP_MAINNET]: { prefix: 'XRP', isNativeL1: true },
    [ChainId.DOGE_MAINNET]: { prefix: 'DOGE', isNativeL1: true },
    // EVM connector / destination chains
    [ChainId.ETH_MAINNET]: { prefix: 'ETH', isNativeL1: false },
    [ChainId.AVAX_MAINNET]: { prefix: 'AVAX', isNativeL1: false },
    [ChainId.BSC_MAINNET]: { prefix: 'BSC', isNativeL1: false },
    [ChainId.BASE_MAINNET]: { prefix: 'BASE', isNativeL1: false },
    [ChainId.TRON_MAINNET]: { prefix: 'TRON', isNativeL1: false },
}

// Flat destination registry: every Thor pool we expose. Lookup via getThorChainDestination.
// Connector tokens are imported from utils.ts so deposit destinations and zapping connectors
// share the same Token instances. Token addresses are checksummed by validateAndParseAddress
// so case differences don't break .equals().
export const THORCHAIN_DESTINATIONS: ThorChainDestination[] = [
    // Native L1
    { token: GAS_TOKEN[ChainId.BTC_MAINNET], thorAsset: 'BTC.BTC' },
    { token: GAS_TOKEN[ChainId.LTC_MAINNET], thorAsset: 'LTC.LTC' },
    { token: GAS_TOKEN[ChainId.BCH_MAINNET], thorAsset: 'BCH.BCH' },
    { token: GAS_TOKEN[ChainId.XRP_MAINNET], thorAsset: 'XRP.XRP' },
    { token: GAS_TOKEN[ChainId.DOGE_MAINNET], thorAsset: 'DOGE.DOGE' },

    // Ethereum
    { token: GAS_TOKEN[ChainId.ETH_MAINNET], thorAsset: 'ETH.ETH' },
    { token: ETH_USDC, thorAsset: 'ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48' },
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
    { token: BSC_USDC, thorAsset: 'BSC.USDC-0X8AC76A51CC950D9822D68B83FE1AD97B32CD580D' },
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
    { token: AVAX_USDC, thorAsset: 'AVAX.USDC-0XB97EF9EF8734C71904D8002F8B6BC66DD9C48A6E' },
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

    // Base
    { token: GAS_TOKEN[ChainId.BASE_MAINNET], thorAsset: 'BASE.ETH' },
    { token: BASE_USDC, thorAsset: 'BASE.USDC-0X833589FCD6EDB6E08F4C7C32D4F71B54BDA02913' },
]

export function getThorChainDestination(token: Token): ThorChainDestination {
    const match = THORCHAIN_DESTINATIONS.find((d) => d.token.equals(token))
    if (!match) {
        throw new ThorChainError(`Unsupported THORChain destination: ${token.symbol} on chain ${token.chainId}`)
    }
    return match
}

export function isThorChainDestinationToken(token: Token | undefined): boolean {
    if (!token) return false
    return THORCHAIN_DESTINATIONS.some((d) => d.token.equals(token))
}

export function isThorChainNativeSourceChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return THORCHAIN_CHAIN_MAP[chainId]?.isNativeL1 === true
}

const THORCHAIN_DESTINATION_CHAIN_IDS = new Set<ChainId>(THORCHAIN_DESTINATIONS.map((d) => d.token.chainId))

export function isThorChainDestinationChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return THORCHAIN_DESTINATION_CHAIN_IDS.has(chainId)
}

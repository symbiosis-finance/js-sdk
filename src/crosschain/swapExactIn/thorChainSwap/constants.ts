import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token } from '../../../entities'
import { ThorChainError } from '../../sdkError'
import type { ThorChainDestination } from './types'

// --- Sources: USDC on the EVM chains THORChain supports ---
const THOR_USDC_ETH: ThorChainDestination = {
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
}
const THOR_USDC_BSC: ThorChainDestination = {
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
}
const THOR_USDC_AVAX: ThorChainDestination = {
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
}

// --- Destinations: native L1 chains THORChain delivers to ---
const THOR_BTC: ThorChainDestination = {
    token: GAS_TOKEN[ChainId.BTC_MAINNET],
    thorAsset: 'BTC.BTC',
}
const THOR_LTC: ThorChainDestination = {
    token: GAS_TOKEN[ChainId.LTC_MAINNET],
    thorAsset: 'LTC.LTC',
}
const THOR_BCH: ThorChainDestination = {
    token: GAS_TOKEN[ChainId.BCH_MAINNET],
    thorAsset: 'BCH.BCH',
}
const THOR_XRP: ThorChainDestination = {
    token: GAS_TOKEN[ChainId.XRP_MAINNET],
    thorAsset: 'XRP.XRP',
}
const THOR_DOGE: ThorChainDestination = {
    token: GAS_TOKEN[ChainId.DOGE_MAINNET],
    thorAsset: 'DOGE.DOGE',
}

const THOR_EVM_CONNECTORS = [THOR_USDC_ETH, THOR_USDC_BSC, THOR_USDC_AVAX]
const THOR_L1_DESTINATIONS = [THOR_BTC, THOR_LTC, THOR_BCH, THOR_XRP, THOR_DOGE]

export const THORCHAIN_TOKENS_EVM_TRANSIT: Token[] = THOR_EVM_CONNECTORS.map((d) => d.token)

export const THORCHAIN_L1_DEST_CHAIN_IDS: ChainId[] = THOR_L1_DESTINATIONS.map((d) => d.token.chainId)

const ALL_THOR_TOKENS: ThorChainDestination[] = [...THOR_EVM_CONNECTORS, ...THOR_L1_DESTINATIONS]

export function getThorChainDestination(token: Token): ThorChainDestination {
    const match = ALL_THOR_TOKENS.find((d) => d.token.equals(token))
    if (!match) {
        throw new ThorChainError(`Unsupported THORChain destination: ${token.symbol} on chain ${token.chainId}`)
    }
    return match
}

export function isThorChainL1DestChainId(chainId: ChainId | undefined): boolean {
    return chainId !== undefined && THORCHAIN_L1_DEST_CHAIN_IDS.includes(chainId)
}

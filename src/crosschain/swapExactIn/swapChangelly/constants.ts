import { ChainId } from '../../../constants'
import { Token } from '../../../entities'
import type { Address } from '../../types'

// --- Transaction building ---

export const TRON_TRANSFER_FEE_LIMIT = 50_000_000 // 50 TRX — covers ~131k energy for TRC-20 transfer (e.g. USDT)
export const DEPOSIT_VALIDITY_MS = 10 * 60 * 1000 // 10 minutes
export const TON_TX_VALIDITY_SECONDS = 600 // 10 minutes — how long TON wallet keeps unsigned tx valid

// --- Chain sets ---

// Chains only reachable via Changelly (no Symbiosis native routing)
const CHANGELLY_NATIVE_CHAIN_IDS = new Set<ChainId>([
    ChainId.XLM_MAINNET,
    ChainId.XRP_MAINNET,
    ChainId.XMR_MAINNET,
    ChainId.ADA_MAINNET,
    ChainId.BCH_MAINNET,
    ChainId.SUI_MAINNET,
    ChainId.CANTON_MAINNET,
    ChainId.DOGE_MAINNET,
    ChainId.LTC_MAINNET,
    ChainId.ZCASH_MAINNET,
])

// All non-native chains supported by Changelly where SDK builds a transfer tx
const CHANGELLY_TRADE_CHAIN_IDS = new Set<ChainId>([
    ChainId.ETH_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.TRON_MAINNET,
    ChainId.SOLANA_MAINNET,
    ChainId.BASE_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.LINEA_MAINNET,
    ChainId.ZKSYNC_MAINNET,
    ChainId.BERACHAIN_MAINNET,
    ChainId.SONIC_MAINNET,
    ChainId.MANTA_MAINNET,
    ChainId.BLAST_MAINNET,
    ChainId.CRONOS_MAINNET,
    ChainId.ZETACHAIN_MAINNET,
    ChainId.CORE_MAINNET,
    ChainId.TAIKO_MAINNET,
    ChainId.SEI_EVM_MAINNET,
    ChainId.KAVA_MAINNET,
    ChainId.PLASMA_MAINNET,
    ChainId.MONAD_MAINNET,
    ChainId.TON_MAINNET,
])

// --- Changelly ticker maps (used by resolveChangellyTicker for fast-path lookup) ---

// Single source of truth for Changelly-exclusive native chains.
// No token registry exists for these — all metadata is defined here.
export const CHANGELLY_NATIVE_CHAINS = [
    { chainId: ChainId.XLM_MAINNET, ticker: 'xlm', symbol: 'XLM', name: 'Stellar', decimals: 7 },
    { chainId: ChainId.XRP_MAINNET, ticker: 'xrp', symbol: 'XRP', name: 'XRP', decimals: 6 },
    { chainId: ChainId.XMR_MAINNET, ticker: 'xmr', symbol: 'XMR', name: 'Monero', decimals: 12 },
    { chainId: ChainId.ADA_MAINNET, ticker: 'ada', symbol: 'ADA', name: 'Cardano', decimals: 6 },
    { chainId: ChainId.BCH_MAINNET, ticker: 'bch', symbol: 'BCH', name: 'Bitcoin Cash', decimals: 8 },
    { chainId: ChainId.SUI_MAINNET, ticker: 'sui', symbol: 'SUI', name: 'Sui', decimals: 9 },
    { chainId: ChainId.CANTON_MAINNET, ticker: 'cc', symbol: 'CC', name: 'Canton Coin', decimals: 10 },
    { chainId: ChainId.DOGE_MAINNET, ticker: 'doge', symbol: 'DOGE', name: 'Dogecoin', decimals: 8 },
    { chainId: ChainId.LTC_MAINNET, ticker: 'ltc', symbol: 'LTC', name: 'Litecoin', decimals: 8 },
    { chainId: ChainId.ZCASH_MAINNET, ticker: 'zec', symbol: 'ZEC', name: 'Zcash', decimals: 8 },
] as const

const CHANGELLY_ONLY_NATIVE_TICKERS = new Map<string, string>(
    CHANGELLY_NATIVE_CHAINS.map(({ chainId, ticker }) => [`${chainId}:native`, ticker])
)

// Native gas tokens per trade chain: fast-path ticker lookup (avoids API call for common natives).
const CHANGELLY_GAS_TRADE_TICKERS = new Map<string, string>([
    [`${ChainId.BTC_MAINNET}:native`, 'btc'],
    [`${ChainId.ETH_MAINNET}:native`, 'eth'],
    [`${ChainId.BSC_MAINNET}:native`, 'bnbbsc'],
    [`${ChainId.TRON_MAINNET}:native`, 'trx'],
    [`${ChainId.SOLANA_MAINNET}:native`, 'sol'],
    [`${ChainId.BASE_MAINNET}:native`, 'ethbase'],
    [`${ChainId.ARBITRUM_MAINNET}:native`, 'etharb'],
    [`${ChainId.OPTIMISM_MAINNET}:native`, 'ethop'],
    [`${ChainId.MATIC_MAINNET}:native`, 'pol'],
    [`${ChainId.AVAX_MAINNET}:native`, 'avaxc'],
    [`${ChainId.SONIC_MAINNET}:native`, 's'],
    [`${ChainId.TON_MAINNET}:native`, 'ton'],
    [`${ChainId.BERACHAIN_MAINNET}:native`, 'bera'],
    [`${ChainId.CRONOS_MAINNET}:native`, 'cro'],
    [`${ChainId.ZETACHAIN_MAINNET}:native`, 'zeta'],
    [`${ChainId.CORE_MAINNET}:native`, 'core'],
    [`${ChainId.KAVA_MAINNET}:native`, 'kava'],
    [`${ChainId.PLASMA_MAINNET}:native`, 'xpl'],
    [`${ChainId.MONAD_MAINNET}:native`, 'mon'],
    [`${ChainId.SEI_EVM_MAINNET}:native`, 'sei'],
])

// Transit ERC-20 per chain for zapping (DEX swap → Changelly deposit).
// Most liquid stable, or chain-native ERC-20 for L2s. Address format matches buildChangellyKey.
const CHANGELLY_TRANSIT_TOKENS: Partial<
    Record<ChainId, { address: string; ticker: string; decimals: number; symbol: string; name: string }>
> = {
    [ChainId.ETH_MAINNET]: {
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ticker: 'usdc',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.BSC_MAINNET]: {
        address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        ticker: 'usdcbsc',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.TRON_MAINNET]: {
        address: '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c', // TR7NHq... in hex
        ticker: 'usdtrx',
        decimals: 6,
        symbol: 'USDT',
        name: 'Tether USD',
    },
    [ChainId.BASE_MAINNET]: {
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        ticker: 'usdcbase',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.ARBITRUM_MAINNET]: {
        address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        ticker: 'usdcarb',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.OPTIMISM_MAINNET]: {
        address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        ticker: 'usdcop',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.MATIC_MAINNET]: {
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        ticker: 'usdcmatic',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.AVAX_MAINNET]: {
        address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        ticker: 'usdcavac',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.SONIC_MAINNET]: {
        address: '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        ticker: 'usdcsonic',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    [ChainId.TON_MAINNET]: {
        address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        ticker: 'usdton',
        decimals: 6,
        symbol: 'USDT',
        name: 'Tether USD',
    },
    // L2 chains — Changelly lists chain-native ERC-20 tokens, not gas ETH
    [ChainId.LINEA_MAINNET]: {
        address: '0x1789e0043623282d5dcc7f213d703c6d8bafbb04',
        ticker: 'linea',
        decimals: 18,
        symbol: 'LINEA',
        name: 'Linea',
    },
    [ChainId.ZKSYNC_MAINNET]: {
        address: '0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e',
        ticker: 'zksync',
        decimals: 18,
        symbol: 'ZK',
        name: 'ZKsync',
    },
    [ChainId.MANTA_MAINNET]: {
        address: '0x95cef13441be50d20ca4558cc0a27b601ac544e5',
        ticker: 'manta',
        decimals: 18,
        symbol: 'MANTA',
        name: 'Manta',
    },
    [ChainId.BLAST_MAINNET]: {
        address: '0xb1a5700fa2358173fe465e6ea4ff52e36e88e2ad',
        ticker: 'blast',
        decimals: 18,
        symbol: 'BLAST',
        name: 'Blast',
    },
    [ChainId.TAIKO_MAINNET]: {
        address: '0xa9d23408b9ba935c230493c40c73824df71a0975',
        ticker: 'taiko',
        decimals: 18,
        symbol: 'TAIKO',
        name: 'Taiko',
    },
}

// Fast-path ticker resolution — avoids API call for common tokens.
export const CHANGELLY_TICKER_MAP = new Map<string, string>([
    ...CHANGELLY_ONLY_NATIVE_TICKERS,
    ...CHANGELLY_GAS_TRADE_TICKERS,
    ...(Object.entries(CHANGELLY_TRANSIT_TOKENS).map(([chainId, t]) => [`${chainId}:${t!.address}`, t!.ticker]) as [
        string,
        string,
    ][]),
])

export const CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID: Record<string, ChainId> = {
    ethereum: ChainId.ETH_MAINNET,
    binance_smart_chain: ChainId.BSC_MAINNET,
    tron: ChainId.TRON_MAINNET,
    solana: ChainId.SOLANA_MAINNET,
    bitcoin: ChainId.BTC_MAINNET,
    BASE: ChainId.BASE_MAINNET,
    arbitrum: ChainId.ARBITRUM_MAINNET,
    optimism: ChainId.OPTIMISM_MAINNET,
    polygon: ChainId.MATIC_MAINNET,
    avaxc: ChainId.AVAX_MAINNET,
    LINEA: ChainId.LINEA_MAINNET,
    ZKSYNC: ChainId.ZKSYNC_MAINNET,
    bera: ChainId.BERACHAIN_MAINNET,
    sonic: ChainId.SONIC_MAINNET,
    manta: ChainId.MANTA_MAINNET,
    blast: ChainId.BLAST_MAINNET,
    cronos: ChainId.CRONOS_MAINNET,
    zetachain: ChainId.ZETACHAIN_MAINNET,
    CORE: ChainId.CORE_MAINNET,
    TAIKO: ChainId.TAIKO_MAINNET,
    sei: ChainId.SEI_EVM_MAINNET,
    kava: ChainId.KAVA_MAINNET,
    plasma: ChainId.PLASMA_MAINNET,
    mon: ChainId.MONAD_MAINNET,
    ton: ChainId.TON_MAINNET,
    zcash: ChainId.ZCASH_MAINNET,
}

// chainId → decimals for resolveOutputToken
export const CHANGELLY_NATIVE_DECIMALS: Partial<Record<ChainId, number>> = Object.fromEntries(
    CHANGELLY_NATIVE_CHAINS.map(({ chainId, decimals }) => [chainId, decimals])
)

// --- Chain detection ---

export function isChangellyNativeChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return CHANGELLY_NATIVE_CHAIN_IDS.has(chainId)
}

export function isChangellyTradeChainId(chainId: ChainId): boolean {
    return CHANGELLY_TRADE_CHAIN_IDS.has(chainId)
}

export function isChangellySupportedChainId(chainId: ChainId | undefined): boolean {
    if (chainId === undefined) return false
    return CHANGELLY_NATIVE_CHAIN_IDS.has(chainId) || CHANGELLY_TRADE_CHAIN_IDS.has(chainId)
}

// --- Transit tokens for on-chain zapping: DEX swap -> Changelly deposit ---

export type ChangellyTransitToken = { token: Token; ticker: string }

export function getChangellyTransitToken(chainId: ChainId): ChangellyTransitToken | undefined {
    const transit = CHANGELLY_TRANSIT_TOKENS[chainId]
    if (!transit) return undefined

    return {
        token: new Token({
            chainId,
            address: transit.address as Address,
            decimals: transit.decimals,
            symbol: transit.symbol,
            name: transit.name,
        }),
        ticker: transit.ticker,
    }
}

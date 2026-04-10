import { ChainId } from '../../../constants'
import type { TokenConstructor } from '../../../entities'
import { Token } from '../../../entities'

export function buildChangellyKeyRaw(chainId: ChainId, address: string, isNative: boolean): string {
    if (isNative) return `${chainId}:native`
    const normalized = address.startsWith('0x') ? address.toLowerCase() : address
    return `${chainId}:${normalized}`
}

// --- Transaction building ---

export const TRON_TRANSFER_FEE_LIMIT = 50_000_000 // 50 TRX — covers ~131k energy for TRC-20 transfer (e.g. USDT)
export const DEPOSIT_VALIDITY_MS = 10 * 60 * 1000 // 10 minutes
export const TON_TX_VALIDITY_SECONDS = 600 // 10 minutes — how long TON wallet keeps unsigned tx valid

// All non-native chains supported by Changelly where SDK builds a transfer tx
const CHANGELLY_TRADE_CHAIN_IDS = new Set<ChainId>([
    // EVM
    ChainId.ETH_MAINNET,
    ChainId.BSC_MAINNET,
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
    // Non EVM
    ChainId.TON_MAINNET,
    ChainId.TRON_MAINNET,
    ChainId.SOLANA_MAINNET,
])

// --- Changelly ticker maps (used by resolveChangellyTicker for fast-path lookup) ---

// Single source of truth for Changelly-exclusive native chains.
// No token registry exists for these — all metadata is defined here.
export const CHANGELLY_NATIVE_CHAINS = [
    // { chainId: ChainId.XLM_MAINNET, ticker: 'xlm', symbol: 'XLM', name: 'Stellar', decimals: 7 },
    // { chainId: ChainId.XRP_MAINNET, ticker: 'xrp', symbol: 'XRP', name: 'XRP', decimals: 6 },
    // { chainId: ChainId.ADA_MAINNET, ticker: 'ada', symbol: 'ADA', name: 'Cardano', decimals: 6 },
    // { chainId: ChainId.BCH_MAINNET, ticker: 'bch', symbol: 'BCH', name: 'Bitcoin Cash', decimals: 8 },
    // { chainId: ChainId.SUI_MAINNET, ticker: 'sui', symbol: 'SUI', name: 'Sui', decimals: 9 },
    // { chainId: ChainId.CANTON_MAINNET, ticker: 'cc', symbol: 'CC', name: 'Canton Coin', decimals: 10 },
    // { chainId: ChainId.DOGE_MAINNET, ticker: 'doge', symbol: 'DOGE', name: 'Dogecoin', decimals: 8 },
    // { chainId: ChainId.LTC_MAINNET, ticker: 'ltc', symbol: 'LTC', name: 'Litecoin', decimals: 8 },
    { chainId: ChainId.XMR_MAINNET, ticker: 'xmr', symbol: 'XMR', name: 'Monero', decimals: 12 },
    { chainId: ChainId.ZCASH_MAINNET, ticker: 'zec', symbol: 'ZEC', name: 'Zcash', decimals: 8 },
] as const

const CHANGELLY_NATIVE_CHAIN_IDS = new Set<ChainId>(CHANGELLY_NATIVE_CHAINS.map(({ chainId }) => chainId))

// Transit ERC-20 per chain for zapping (DEX swap → Changelly deposit).
// Most liquid stable, or chain-native ERC-20 for L2s. Address format matches buildChangellyKey.
const CHANGELLY_TRANSIT_TOKENS: (TokenConstructor & { ticker: string })[] = [
    {
        chainId: ChainId.ETH_MAINNET,
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        ticker: 'usdc',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.BSC_MAINNET,
        address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        ticker: 'usdcbsc',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.TRON_MAINNET,
        address: '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c', // TR7NHq... in hex
        ticker: 'usdtrx',
        decimals: 6,
        symbol: 'USDT',
        name: 'Tether USD',
    },
    {
        chainId: ChainId.BASE_MAINNET,
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        ticker: 'usdcbase',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.ARBITRUM_MAINNET,
        address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        ticker: 'usdcarb',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.OPTIMISM_MAINNET,
        address: '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        ticker: 'usdcop',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.MATIC_MAINNET,
        address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        ticker: 'usdcmatic',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.AVAX_MAINNET,
        address: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
        ticker: 'usdcavac',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.SONIC_MAINNET,
        address: '0x29219dd400f2bf60e5a23d13be72b486d4038894',
        ticker: 'usdcsonic',
        decimals: 6,
        symbol: 'USDC',
        name: 'USD Coin',
    },
    {
        chainId: ChainId.TON_MAINNET,
        address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
        ticker: 'usdton',
        decimals: 6,
        symbol: 'USDT',
        name: 'Tether USD',
    },
    // L2 chains — Changelly lists chain-native ERC-20 tokens, not gas ETH
    {
        chainId: ChainId.LINEA_MAINNET,
        address: '0x1789e0043623282d5dcc7f213d703c6d8bafbb04',
        ticker: 'linea',
        decimals: 18,
        symbol: 'LINEA',
        name: 'Linea',
    },
    {
        chainId: ChainId.ZKSYNC_MAINNET,
        address: '0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e',
        ticker: 'zksync',
        decimals: 18,
        symbol: 'ZK',
        name: 'ZKsync',
    },
    {
        chainId: ChainId.MANTA_MAINNET,
        address: '0x95cef13441be50d20ca4558cc0a27b601ac544e5',
        ticker: 'manta',
        decimals: 18,
        symbol: 'MANTA',
        name: 'Manta',
    },
    {
        chainId: ChainId.BLAST_MAINNET,
        address: '0xb1a5700fa2358173fe465e6ea4ff52e36e88e2ad',
        ticker: 'blast',
        decimals: 18,
        symbol: 'BLAST',
        name: 'Blast',
    },
    {
        chainId: ChainId.TAIKO_MAINNET,
        address: '0xa9d23408b9ba935c230493c40c73824df71a0975',
        ticker: 'taiko',
        decimals: 18,
        symbol: 'TAIKO',
        name: 'Taiko',
    },
]

// Fast-path ticker resolution — avoids API call for common tokens.
export const CHANGELLY_FAST_TICKER_MAP = new Map<string, string>([
    // Changelly-native chains (gas tokens)
    ...CHANGELLY_NATIVE_CHAINS.map(({ chainId, ticker }) => [buildChangellyKeyRaw(chainId, '', true), ticker] as const),
    // Trade chain gas tokens
    [buildChangellyKeyRaw(ChainId.ETH_MAINNET, '', true), 'eth'],
    [buildChangellyKeyRaw(ChainId.BSC_MAINNET, '', true), 'bnbbsc'],
    [buildChangellyKeyRaw(ChainId.BASE_MAINNET, '', true), 'ethbase'],
    [buildChangellyKeyRaw(ChainId.ARBITRUM_MAINNET, '', true), 'etharb'],
    [buildChangellyKeyRaw(ChainId.OPTIMISM_MAINNET, '', true), 'ethop'],
    [buildChangellyKeyRaw(ChainId.MATIC_MAINNET, '', true), 'pol'],
    [buildChangellyKeyRaw(ChainId.AVAX_MAINNET, '', true), 'avaxc'],
    [buildChangellyKeyRaw(ChainId.SONIC_MAINNET, '', true), 's'],
    [buildChangellyKeyRaw(ChainId.BERACHAIN_MAINNET, '', true), 'bera'],
    [buildChangellyKeyRaw(ChainId.CRONOS_MAINNET, '', true), 'cro'],
    [buildChangellyKeyRaw(ChainId.ZETACHAIN_MAINNET, '', true), 'zeta'],
    [buildChangellyKeyRaw(ChainId.CORE_MAINNET, '', true), 'core'],
    [buildChangellyKeyRaw(ChainId.KAVA_MAINNET, '', true), 'kava'],
    [buildChangellyKeyRaw(ChainId.PLASMA_MAINNET, '', true), 'xpl'],
    [buildChangellyKeyRaw(ChainId.MONAD_MAINNET, '', true), 'mon'],
    [buildChangellyKeyRaw(ChainId.SEI_EVM_MAINNET, '', true), 'sei'],
    [buildChangellyKeyRaw(ChainId.TRON_MAINNET, '', true), 'trx'],
    [buildChangellyKeyRaw(ChainId.TON_MAINNET, '', true), 'ton'],
    [buildChangellyKeyRaw(ChainId.SOLANA_MAINNET, '', true), 'sol'],
    // Transit tokens (ERC-20 / jettons)
    ...CHANGELLY_TRANSIT_TOKENS.map(
        (token) => [buildChangellyKeyRaw(token.chainId, token.address, false), token.ticker] as [string, string]
    ),
])

export const CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID: Record<string, ChainId> = {
    // EVM
    ethereum: ChainId.ETH_MAINNET,
    binance_smart_chain: ChainId.BSC_MAINNET,
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
    // Non-EVM trade chains
    tron: ChainId.TRON_MAINNET,
    solana: ChainId.SOLANA_MAINNET,
    ton: ChainId.TON_MAINNET,
    bitcoin: ChainId.BTC_MAINNET,
    // Changelly-native chains
    litecoin: ChainId.LTC_MAINNET,
    doge: ChainId.DOGE_MAINNET,
    monero: ChainId.XMR_MAINNET,
    ripple: ChainId.XRP_MAINNET,
    stellar: ChainId.XLM_MAINNET,
    cardano: ChainId.ADA_MAINNET,
    bitcoin_cash: ChainId.BCH_MAINNET,
    sui: ChainId.SUI_MAINNET,
    cc: ChainId.CANTON_MAINNET,
    zcash: ChainId.ZCASH_MAINNET,
}

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
    const transitToken = CHANGELLY_TRANSIT_TOKENS.find((t) => t.chainId === chainId)
    if (!transitToken) return undefined

    return {
        token: new Token(transitToken),
        ticker: transitToken.ticker,
    }
}

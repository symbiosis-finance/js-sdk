import { ChainId } from '../../../constants'

// --- Transaction building ---

export const TRON_TRANSFER_FEE_LIMIT = 50_000_000 // 50 TRX — covers ~131k energy for TRC-20 transfer (e.g. USDT)
export const DEPOSIT_VALIDITY_MS = 10 * 60 * 1000 // 10 minutes
export const TON_TX_VALIDITY_SECONDS = 600 // 10 minutes — how long TON wallet keeps unsigned tx valid

// --- Chain sets ---

// Chains only reachable via Changelly (no Symbiosis native routing)
export const CHANGELLY_NATIVE_CHAIN_IDS = new Set<ChainId>([
    ChainId.XLM_MAINNET,
    ChainId.XRP_MAINNET,
    ChainId.XMR_MAINNET,
    ChainId.ADA_MAINNET,
    ChainId.BCH_MAINNET,
    ChainId.SUI_MAINNET,
    ChainId.CANTON_MAINNET,
    ChainId.DOGE_MAINNET,
    ChainId.LTC_MAINNET,
])

// All non-native chains supported by Changelly where SDK builds a transfer tx
export const CHANGELLY_TRADE_CHAIN_IDS = new Set<ChainId>([
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

// Key: "chainId:native" for gas tokens, "chainId:lowercaseAddress" for stables
// Only native gas tokens + USDC + USDT per chain (for future on-chain swap -> Changelly flow)

export const CHANGELLY_TRANSIT_TOKEN_MAP = new Map<string, string>([
    // Changelly-native chains (single token per chain)
    [`${ChainId.XLM_MAINNET}:native`, 'xlm'],
    [`${ChainId.XRP_MAINNET}:native`, 'xrp'],
    [`${ChainId.XMR_MAINNET}:native`, 'xmr'],
    [`${ChainId.ADA_MAINNET}:native`, 'ada'],
    [`${ChainId.BCH_MAINNET}:native`, 'bch'],
    [`${ChainId.SUI_MAINNET}:native`, 'sui'],
    [`${ChainId.CANTON_MAINNET}:native`, 'cc'],
    [`${ChainId.DOGE_MAINNET}:native`, 'doge'],
    [`${ChainId.LTC_MAINNET}:native`, 'ltc'],

    // Ethereum
    [`${ChainId.ETH_MAINNET}:native`, 'eth'],
    [`${ChainId.ETH_MAINNET}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`, 'usdc'],
    [`${ChainId.ETH_MAINNET}:0xdac17f958d2ee523a2206206994597c13d831ec7`, 'usdt20'],

    // BSC
    [`${ChainId.BSC_MAINNET}:native`, 'bnbbsc'],
    [`${ChainId.BSC_MAINNET}:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d`, 'usdcbsc'],
    [`${ChainId.BSC_MAINNET}:0x55d398326f99059ff775485246999027b3197955`, 'usdtbsc'],

    // TRON
    [`${ChainId.TRON_MAINNET}:native`, 'trx'],
    [`${ChainId.TRON_MAINNET}:0xa614f803b6fd780986a42c78ec9c7f77e6ded13c`, 'usdtrx'], // TR7NHq... in hex

    // Solana
    [`${ChainId.SOLANA_MAINNET}:native`, 'sol'],

    // Base
    [`${ChainId.BASE_MAINNET}:native`, 'ethbase'],
    [`${ChainId.BASE_MAINNET}:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`, 'usdcbase'],

    // Arbitrum
    [`${ChainId.ARBITRUM_MAINNET}:native`, 'etharb'],
    [`${ChainId.ARBITRUM_MAINNET}:0xaf88d065e77c8cc2239327c5edb3a432268e5831`, 'usdcarb'],
    [`${ChainId.ARBITRUM_MAINNET}:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9`, 'usdtarb'],

    // Optimism
    [`${ChainId.OPTIMISM_MAINNET}:native`, 'ethop'],
    [`${ChainId.OPTIMISM_MAINNET}:0x0b2c639c533813f4aa9d7837caf62653d097ff85`, 'usdcop'],
    [`${ChainId.OPTIMISM_MAINNET}:0x94b008aa00579c1307b0ef2c499ad98a8ce58e58`, 'usdtop'],

    // Polygon
    [`${ChainId.MATIC_MAINNET}:native`, 'pol'],
    [`${ChainId.MATIC_MAINNET}:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359`, 'usdcmatic'],
    [`${ChainId.MATIC_MAINNET}:0xc2132d05d31c914a87c6611c10748aeb04b58e8f`, 'usdtpolygon'],

    // Avalanche C-Chain
    [`${ChainId.AVAX_MAINNET}:native`, 'avaxc'],
    [`${ChainId.AVAX_MAINNET}:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e`, 'usdcavac'],
    [`${ChainId.AVAX_MAINNET}:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7`, 'usdtavac'],

    // Sonic
    [`${ChainId.SONIC_MAINNET}:native`, 's'],
    [`${ChainId.SONIC_MAINNET}:0x29219dd400f2bf60e5a23d13be72b486d4038894`, 'usdcsonic'],

    // TON
    [`${ChainId.TON_MAINNET}:native`, 'ton'],

    // Chains with native gas token only
    [`${ChainId.BERACHAIN_MAINNET}:native`, 'bera'],
    [`${ChainId.CRONOS_MAINNET}:native`, 'cro'],
    [`${ChainId.ZETACHAIN_MAINNET}:native`, 'zeta'],
    [`${ChainId.CORE_MAINNET}:native`, 'core'],
    [`${ChainId.KAVA_MAINNET}:native`, 'kava'],
    [`${ChainId.PLASMA_MAINNET}:native`, 'xpl'],
    [`${ChainId.MONAD_MAINNET}:native`, 'mon'],
    [`${ChainId.SEI_EVM_MAINNET}:native`, 'sei'],

    // L2 chains — Changelly lists chain-native ERC-20 tokens, not gas ETH
    [`${ChainId.LINEA_MAINNET}:0x1789e0043623282d5dcc7f213d703c6d8bafbb04`, 'linea'],
    [`${ChainId.ZKSYNC_MAINNET}:0x5a7d6b2f92c77fad6ccabd7ee0624e64907eaf3e`, 'zksync'],
    [`${ChainId.MANTA_MAINNET}:0x95cef13441be50d20ca4558cc0a27b601ac544e5`, 'manta'],
    [`${ChainId.BLAST_MAINNET}:0xb1a5700fa2358173fe465e6ea4ff52e36e88e2ad`, 'blast'],
    [`${ChainId.TAIKO_MAINNET}:0xa9d23408b9ba935c230493c40c73824df71a0975`, 'taiko'],
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
}

// Native token decimals for Changelly-native chains
export const CHANGELLY_NATIVE_DECIMALS: Partial<Record<ChainId, number>> = {
    [ChainId.XLM_MAINNET]: 7,
    [ChainId.XRP_MAINNET]: 6,
    [ChainId.XMR_MAINNET]: 12,
    [ChainId.ADA_MAINNET]: 6,
    [ChainId.BCH_MAINNET]: 8,
    [ChainId.SUI_MAINNET]: 9,
    [ChainId.CANTON_MAINNET]: 10,
    [ChainId.DOGE_MAINNET]: 8,
    [ChainId.LTC_MAINNET]: 8,
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

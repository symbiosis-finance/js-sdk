import type { Token } from '../entities'
import { SymbiosisTradeType } from './trade'
import type { SymbiosisTrade } from './trade/symbiosisTrade'

export type SwapLabel = 'src-chain-swap' | 'octopool-swap' | 'dst-chain-swap' | 'mixed-value-tokens' | 'partner-swap'

type ValueCategory = 'stable-usd' | 'btc' | 'eth' | 'other'

const STABLE_SYMBOLS = new Set([
    'USDC',
    'USDT',
    'DAI',
    'BUSD',
    'FRAX',
    'LUSD',
    'MIM',
    'TUSD',
    'USDB',
    'USDE',
    'USDY',
    'USDP',
    'GUSD',
    'CUSD',
    'CRVUSD',
    'SUSD',
    'SYUSDC',
    'SYUSDT',
    'SYDAI',
    'USDC.E',
    'USDC.N',
])

const ETH_SYMBOLS = new Set(['ETH', 'WETH', 'STETH', 'WSTETH', 'RETH', 'WEETH', 'SYETH'])

export function getValueCategory(token: Token): ValueCategory {
    const symbol = (token.symbol ?? '').toUpperCase()
    if (STABLE_SYMBOLS.has(symbol)) return 'stable-usd'
    if (symbol.endsWith('BTC') || symbol === 'BTCB') return 'btc'
    if (ETH_SYMBOLS.has(symbol)) return 'eth'
    return 'other'
}

function isRealSwap(trade: SymbiosisTrade): boolean {
    return trade.tradeType !== SymbiosisTradeType.WRAP
}

export interface LabelsContext {
    tradeA?: SymbiosisTrade
    tradeC?: SymbiosisTrade
}

/**
 * Compute labels for a crosschain swap based on what trades are present.
 *
 * src-chain-swap     — there is a real DEX swap on the source chain (tradeA)
 * dst-chain-swap     — there is a real DEX swap on the destination chain (tradeC)
 * octopool-swap      — always present for crosschain swaps (Symbiosis octopool is always used)
 * mixed-value-tokens — tradeA or tradeC exchanges tokens of different value categories
 *                      (e.g. stablecoins routed through a volatile-asset pool).
 *                      NOTE: octopool itself never contributes to this — its assets are always
 *                      of the same value category within a given pool.
 */
export function computeCrosschainLabels({ tradeA, tradeC }: LabelsContext): SwapLabel[] {
    const labels = new Set<SwapLabel>()

    // The Symbiosis octopool is always involved in any crosschain swap.
    labels.add('octopool-swap')

    if (tradeA && isRealSwap(tradeA)) {
        labels.add('src-chain-swap')
    }

    if (tradeC && isRealSwap(tradeC)) {
        labels.add('dst-chain-swap')
        if (tradeC.isMixedValue) {
            labels.add('mixed-value-tokens')
        }
    }

    return Array.from(labels)
}

/**
 * Compute labels for an on-chain swap leg (used in from-btc-swap onchain case).
 * Treats the trade as happening on the destination chain.
 */
export function computeOnchainDstLabels(trade: SymbiosisTrade): SwapLabel[] {
    if (!isRealSwap(trade)) return []

    const labels: SwapLabel[] = ['dst-chain-swap']
    // if (trade.isMixedValue) {
    //     labels.push('mixed-value-tokens')
    // }
    return labels
}

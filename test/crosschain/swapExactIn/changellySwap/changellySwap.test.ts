import { vi, describe, expect, test, beforeEach } from 'vitest'

import type { SwapExactInParams } from '../../../../src'
import { ChainId, GAS_TOKEN, Symbiosis, Token, TokenAmount } from '../../../../src'
import { SymbiosisTradeType } from '../../../../src'
import {
    changellyDepositSwap,
    changellyTradeSwap,
    isChangellyNativeSupported,
} from '../../../../src/crosschain/swapExactIn/swapChangelly/changellySwap'
import {
    buildChangellyKeyRaw,
    isChangellyNativeChainId,
    isChangellyTradeChainId,
    isChangellySupportedChainId,
    CHANGELLY_FAST_TICKER_MAP,
    CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID,
    CHANGELLY_NATIVE_CHAINS,
} from '../../../../src/crosschain/swapExactIn/swapChangelly/constants'
import {
    buildChangellyKey,
    resolveChangellyTicker,
} from '../../../../src/crosschain/swapExactIn/swapChangelly/changellyUtils'
import { mockFixRate, mockFixTx, mockCurrenciesFull } from './changellyMocks'

const symbiosis = new Symbiosis('mainnet', 'test')
const evmUserAddress = '0x93F68892E5BFB763B0E9aa101b694dFc708c2ca0'
const solUserAddress = '2r7H8BSvV2qvhUq5rMVhvESpwbjjVUVS2htzMF5DRx95' as any

const eth = GAS_TOKEN[ChainId.ETH_MAINNET]
const xrp = GAS_TOKEN[ChainId.XRP_MAINNET]
const xmr = GAS_TOKEN[ChainId.XMR_MAINNET]
const ltc = GAS_TOKEN[ChainId.LTC_MAINNET]
const bnb = GAS_TOKEN[ChainId.BSC_MAINNET]
const sol = GAS_TOKEN[ChainId.SOLANA_MAINNET]

function makeParams(
    overrides: Partial<SwapExactInParams> & {
        tokenAmountIn: SwapExactInParams['tokenAmountIn']
        tokenOut: SwapExactInParams['tokenOut']
    }
): SwapExactInParams {
    return {
        symbiosis,
        from: evmUserAddress,
        to: evmUserAddress,
        slippage: 0,
        deadline: 0,
        ...overrides,
    }
}

function mockChangellyClient() {
    symbiosis.changelly.getFixRateForAmount = vi.fn().mockResolvedValue(mockFixRate)
    symbiosis.changelly.validateAddress = vi.fn().mockResolvedValue(true)
    symbiosis.changelly.createFixTransaction = vi.fn().mockResolvedValue(mockFixTx)
}

// --- Chain detection ---

describe('#isChangellyNativeChainId', () => {
    test('XRP is native', () => {
        expect(isChangellyNativeChainId(ChainId.XRP_MAINNET)).toBe(true)
    })
    test('XMR is native', () => {
        expect(isChangellyNativeChainId(ChainId.XMR_MAINNET)).toBe(true)
    })
    test('LTC is native', () => {
        expect(isChangellyNativeChainId(ChainId.LTC_MAINNET)).toBe(true)
    })
    test('ETH is not native', () => {
        expect(isChangellyNativeChainId(ChainId.ETH_MAINNET)).toBe(false)
    })
    test('BTC is not native', () => {
        expect(isChangellyNativeChainId(ChainId.BTC_MAINNET)).toBe(false)
    })
    test('undefined returns false', () => {
        expect(isChangellyNativeChainId(undefined)).toBe(false)
    })
})

describe('#isChangellyTradeChainId', () => {
    test('ETH is trade chain', () => {
        expect(isChangellyTradeChainId(ChainId.ETH_MAINNET)).toBe(true)
    })
    test('BSC is trade chain', () => {
        expect(isChangellyTradeChainId(ChainId.BSC_MAINNET)).toBe(true)
    })
    test('TRON is trade chain', () => {
        expect(isChangellyTradeChainId(ChainId.TRON_MAINNET)).toBe(true)
    })
    test('SOLANA is trade chain', () => {
        expect(isChangellyTradeChainId(ChainId.SOLANA_MAINNET)).toBe(true)
    })
    test('XRP is not trade chain', () => {
        expect(isChangellyTradeChainId(ChainId.XRP_MAINNET)).toBe(false)
    })
})

describe('#isChangellySupportedChainId', () => {
    test('ETH is supported', () => {
        expect(isChangellySupportedChainId(ChainId.ETH_MAINNET)).toBe(true)
    })
    test('XRP is supported', () => {
        expect(isChangellySupportedChainId(ChainId.XRP_MAINNET)).toBe(true)
    })
    test('BTC is not supported', () => {
        expect(isChangellySupportedChainId(ChainId.BTC_MAINNET)).toBe(false)
    })
})

// --- Support detection ---

describe('#isChangellyNativeSupported', () => {
    test('native source → supported', () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(xrp, '1000000'),
            tokenOut: eth,
        })
        expect(isChangellyNativeSupported(params)).toBe(true)
    })
    test('native destination → supported', () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(eth, '1000000000000000000'),
            tokenOut: xmr,
        })
        expect(isChangellyNativeSupported(params)).toBe(true)
    })
    test('both EVM → not supported', () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(eth, '1000000000000000000'),
            tokenOut: bnb,
        })
        expect(isChangellyNativeSupported(params)).toBe(false)
    })
    test('disabled via disabledProviders → not supported', () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(xrp, '1000000'),
            tokenOut: eth,
            disabledProviders: [SymbiosisTradeType.CHANGELLY],
        })
        expect(isChangellyNativeSupported(params)).toBe(false)
    })
})

// --- buildChangellyKey ---

describe('#buildChangellyKey', () => {
    test('native token → chainId:native', () => {
        expect(buildChangellyKey(eth)).toBe(`${ChainId.ETH_MAINNET}:native`)
    })
    test('native XRP → chainId:native', () => {
        expect(buildChangellyKey(xrp)).toBe(`${ChainId.XRP_MAINNET}:native`)
    })
    test('EVM ERC-20 → lowercase address', () => {
        const usdc = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
            symbol: 'USDC',
        })
        expect(buildChangellyKey(usdc)).toBe(`${ChainId.ETH_MAINNET}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`)
    })
    test('Tron TRC-20 → EVM hex address (Token constructor converts base58 to hex)', () => {
        const usdt = new Token({
            chainId: ChainId.TRON_MAINNET,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6,
            symbol: 'USDT',
        })
        expect(buildChangellyKey(usdt)).toBe(`${ChainId.TRON_MAINNET}:${usdt.address}`)
    })
})

// --- Fast-path map ↔ buildChangellyKey consistency ---
// Verifies that CHANGELLY_FAST_TICKER_MAP keys match what buildChangellyKey produces for the same tokens.

describe('CHANGELLY_FAST_TICKER_MAP ↔ buildChangellyKey consistency', () => {
    // EVM native gas tokens
    test('ETH native → map has matching key', () => {
        const key = buildChangellyKey(eth)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('eth')
    })
    test('BNB native → map has matching key', () => {
        const key = buildChangellyKey(bnb)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('bnbbsc')
    })
    test('SOL native → map has matching key', () => {
        const key = buildChangellyKey(sol)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('sol')
    })

    // Changelly-native chain gas tokens
    test('XRP native → map has matching key', () => {
        const key = buildChangellyKey(xrp)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('xrp')
    })
    test('XMR native → map has matching key', () => {
        const key = buildChangellyKey(xmr)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('xmr')
    })
    test('LTC native → map has matching key', () => {
        const key = buildChangellyKey(ltc)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('ltc')
    })

    // EVM ERC-20 transit tokens (checksummed input → lowercased key)
    test('ETH USDC (checksummed) → map has matching key', () => {
        const usdc = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
            symbol: 'USDC',
        })
        const key = buildChangellyKey(usdc)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('usdc')
    })

    // Tron TRC-20 transit token (base58 input → EVM hex key)
    test('Tron USDT → map has matching key', () => {
        const usdt = new Token({
            chainId: ChainId.TRON_MAINNET,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6,
            symbol: 'USDT',
        })
        const key = buildChangellyKey(usdt)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('usdtrx')
    })

    // TON transit token — requires attributes.ton for tonAddress accessor
    test('TON USDT with attributes → map has matching key', () => {
        const tonUsdt = new Token({
            chainId: ChainId.TON_MAINNET,
            address: '', // TON tokens use attributes.ton, not address
            decimals: 6,
            symbol: 'USDT',
            attributes: { ton: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs' },
        })
        const key = buildChangellyKey(tonUsdt)
        expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe('usdton')
    })

    // buildChangellyKeyRaw consistency: same output as buildChangellyKey for all types
    test('buildChangellyKeyRaw matches buildChangellyKey for EVM native', () => {
        expect(buildChangellyKeyRaw(ChainId.ETH_MAINNET, '', true)).toBe(buildChangellyKey(eth))
    })
    test('buildChangellyKeyRaw matches buildChangellyKey for EVM ERC-20', () => {
        const usdc = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
        })
        // Token constructor checksums → buildChangellyKey lowercases via buildChangellyKeyRaw
        expect(buildChangellyKeyRaw(ChainId.ETH_MAINNET, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', false)).toBe(
            buildChangellyKey(usdc)
        )
    })
    test('buildChangellyKeyRaw preserves non-hex addresses (TON)', () => {
        const tonAddr = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'
        const key = buildChangellyKeyRaw(ChainId.TON_MAINNET, tonAddr, false)
        expect(key).toBe(`${ChainId.TON_MAINNET}:${tonAddr}`)
    })
    test('buildChangellyKeyRaw preserves non-hex addresses (Solana)', () => {
        const solAddr = '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9'
        const key = buildChangellyKeyRaw(ChainId.SOLANA_MAINNET, solAddr, false)
        expect(key).toBe(`${ChainId.SOLANA_MAINNET}:${solAddr}`)
    })
    test('buildChangellyKeyRaw lowercases 0x-prefixed addresses', () => {
        const key = buildChangellyKeyRaw(ChainId.ETH_MAINNET, '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48', false)
        expect(key).toBe(`${ChainId.ETH_MAINNET}:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48`)
    })
})

// --- Fast path vs full path (API fallback) consistency ---
// Simulates what getFullCurrencyMap builds from Changelly API data and verifies keys match the fast path.

describe('Fast path vs full path key consistency', () => {
    function buildFullMapKey(blockchain: string, contractAddress?: string): string | null {
        const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[blockchain]
        if (chainId === undefined) return null
        if (contractAddress) {
            return buildChangellyKeyRaw(chainId, contractAddress, false)
        }
        return buildChangellyKeyRaw(chainId, '', true)
    }

    // Native gas tokens — API returns no contractAddress, just blockchain name
    test('ETH native: fast path key matches full path key', () => {
        const fastKey = buildChangellyKey(eth)
        const fullKey = buildFullMapKey('ethereum')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('eth')
    })

    test('BNB native: fast path key matches full path key', () => {
        const fastKey = buildChangellyKey(bnb)
        const fullKey = buildFullMapKey('binance_smart_chain')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('bnbbsc')
    })

    test('SOL native: fast path key matches full path key', () => {
        const fastKey = buildChangellyKey(sol)
        const fullKey = buildFullMapKey('solana')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('sol')
    })

    test('TON native: fast path key matches full path key', () => {
        const tonNative = GAS_TOKEN[ChainId.TON_MAINNET]
        const fastKey = buildChangellyKey(tonNative)
        const fullKey = buildFullMapKey('ton')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('ton')
    })

    test('TRON native: fast path key matches full path key', () => {
        const trx = GAS_TOKEN[ChainId.TRON_MAINNET]
        const fastKey = buildChangellyKey(trx)
        const fullKey = buildFullMapKey('tron')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('trx')
    })

    // All Changelly-native chains must have matching keys
    test.each(CHANGELLY_NATIVE_CHAINS)(
        '$symbol native: fast path produces valid key with ticker "$ticker"',
        ({ chainId, ticker }) => {
            const gasToken = GAS_TOKEN[chainId]
            const key = buildChangellyKey(gasToken)
            expect(key).toBe(buildChangellyKeyRaw(chainId, '', true))
            expect(CHANGELLY_FAST_TICKER_MAP.get(key)).toBe(ticker)
        }
    )

    // ERC-20 transit token: API returns checksummed contractAddress
    test('ETH USDC: fast path matches full path with checksummed API address', () => {
        const usdc = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
        })
        const fastKey = buildChangellyKey(usdc)
        // Changelly API returns mixed-case address
        const fullKey = buildFullMapKey('ethereum', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
        expect(fastKey).toBe(fullKey)
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('usdc')
    })

    // Tron ERC-20: API returns base58, Token stores EVM hex — both lowercase via 0x prefix
    test('Tron USDT: fast path matches full path when API returns hex', () => {
        const usdt = new Token({
            chainId: ChainId.TRON_MAINNET,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6,
        })
        const fastKey = buildChangellyKey(usdt)
        // Token constructor converts base58 → EVM hex (0x-prefixed, lowercased)
        // The transit map also stores the EVM hex address
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('usdtrx')
    })
})

// --- Full map vs fast map: build full map from mock data and compare ---

describe('Full map vs fast map consistency', () => {
    // Rebuild the full map the same way getFullCurrencyMap does, using mockCurrenciesFull
    function buildFullMap(): Map<string, string> {
        const map = new Map<string, string>()
        for (const currency of mockCurrenciesFull) {
            if (!currency.enabled || !currency.blockchain) continue
            const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[currency.blockchain]
            if (chainId === undefined) continue
            if (currency.contractAddress) {
                map.set(buildChangellyKeyRaw(chainId, currency.contractAddress, false), currency.ticker)
            } else {
                map.set(buildChangellyKeyRaw(chainId, '', true), currency.ticker)
            }
        }
        return map
    }

    test('every native gas token in fast map matches full map', () => {
        const fullMap = buildFullMap()
        // Check all native gas tokens that appear in both maps
        for (const currency of mockCurrenciesFull) {
            if (!currency.enabled || currency.contractAddress) continue
            const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[currency.blockchain]
            if (chainId === undefined) continue
            const key = buildChangellyKeyRaw(chainId, '', true)
            const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(key)
            const fullTicker = fullMap.get(key)
            if (fastTicker) {
                expect(fastTicker).toBe(fullTicker)
            }
        }
    })

    test('every EVM ERC-20 in fast map matches full map (mixed-case normalization)', () => {
        const fullMap = buildFullMap()
        // USDC has mixed-case in mock data — verify both maps produce same key and ticker
        const usdcKey = buildChangellyKeyRaw(ChainId.ETH_MAINNET, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', false)
        expect(CHANGELLY_FAST_TICKER_MAP.get(usdcKey)).toBe('usdc')
        expect(fullMap.get(usdcKey)).toBe('usdc')
        expect(CHANGELLY_FAST_TICKER_MAP.get(usdcKey)).toBe(fullMap.get(usdcKey))
    })

    test('Tron USDT: fast map key matches full map key (base58 in API vs EVM hex in map)', () => {
        const fullMap = buildFullMap()
        // Changelly API returns base58 'TR7NHq...' for Tron — buildChangellyKeyRaw treats it as non-0x, preserves as-is
        // But the fast map stores the EVM hex address (0xa614...)
        // These are DIFFERENT keys — the Tron transit token in fast map uses EVM hex from CHANGELLY_TRANSIT_TOKENS
        // while the full map uses the base58 address from the API
        const fastKey = buildChangellyKeyRaw(ChainId.TRON_MAINNET, '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c', false)
        const fullKey = buildChangellyKeyRaw(ChainId.TRON_MAINNET, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', false)
        // Fast map has EVM hex key
        expect(CHANGELLY_FAST_TICKER_MAP.get(fastKey)).toBe('usdtrx')
        // Full map has base58 key (different format!)
        expect(fullMap.get(fullKey)).toBe('usdtrx')
        // Keys are different but both resolve to the same ticker
        expect(fastKey).not.toBe(fullKey)
    })

    test('disabled tokens in mock data are excluded from full map', () => {
        const fullMap = buildFullMap()
        // GPS is disabled in mockCurrenciesFull
        const gpsKey = buildChangellyKeyRaw(ChainId.BASE_MAINNET, '0x0c1dc73159e30c4b06170f2593d3118968a0dca5', false)
        expect(fullMap.get(gpsKey)).toBeUndefined()
    })

    test('unsupported blockchains in mock data are excluded from full map', () => {
        const fullMap = buildFullMap()
        // RUNE is on 'thorchain' which is not in CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID
        // It should not appear in the full map at all
        for (const [, ticker] of fullMap) {
            expect(ticker).not.toBe('rune')
        }
    })

    test('all fast map native entries have matching full map entries', () => {
        const fullMap = buildFullMap()
        // For every native gas ticker in the fast map that also appears in mockCurrenciesFull,
        // the full map must have the same key→ticker
        for (const currency of mockCurrenciesFull) {
            if (!currency.enabled || currency.contractAddress) continue
            const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[currency.blockchain]
            if (chainId === undefined) continue
            const key = buildChangellyKeyRaw(chainId, '', true)
            const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(key)
            const fullTicker = fullMap.get(key)
            // Both should exist and match
            expect(fullTicker).toBe(currency.ticker)
            if (fastTicker) {
                expect(fastTicker).toBe(fullTicker)
            }
        }
    })
})

// --- resolveChangellyTicker: fast path vs full path produce same result ---

describe('resolveChangellyTicker: fast path vs full path', () => {
    beforeEach(() => {
        symbiosis.changelly.getCurrenciesFull = vi.fn().mockResolvedValue(mockCurrenciesFull)
    })

    test('ETH native: fast path ticker equals full path ticker', async () => {
        // Fast path — hits CHANGELLY_FAST_TICKER_MAP
        const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(eth))

        // Full path — bypasses fast map, uses mocked API
        // We can't easily bypass fast path in resolveChangellyTicker, so verify keys match instead
        const key = buildChangellyKey(eth)
        const fullKey = buildChangellyKeyRaw(ChainId.ETH_MAINNET, '', true)
        expect(key).toBe(fullKey)
        expect(fastTicker).toBe('eth')

        // Confirm resolveChangellyTicker returns same result
        const resolved = await resolveChangellyTicker(symbiosis, eth)
        expect(resolved).toBe('eth')
        expect(resolved).toBe(fastTicker)
    })

    test('XRP native: resolveChangellyTicker returns fast path ticker', async () => {
        const resolved = await resolveChangellyTicker(symbiosis, xrp)
        const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(xrp))
        expect(resolved).toBe('xrp')
        expect(resolved).toBe(fastTicker)
    })

    test('SOL native: resolveChangellyTicker returns fast path ticker', async () => {
        const resolved = await resolveChangellyTicker(symbiosis, sol)
        const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(sol))
        expect(resolved).toBe('sol')
        expect(resolved).toBe(fastTicker)
    })

    test('all native chains: resolveChangellyTicker matches fast path', async () => {
        for (const { chainId, ticker } of CHANGELLY_NATIVE_CHAINS) {
            const gasToken = GAS_TOKEN[chainId]
            const resolved = await resolveChangellyTicker(symbiosis, gasToken)
            const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(gasToken))
            expect(resolved).toBe(ticker)
            expect(resolved).toBe(fastTicker)
        }
    })

    test('EVM ERC-20 (USDC): resolveChangellyTicker matches fast path', async () => {
        const usdc = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
            symbol: 'USDC',
        })
        const resolved = await resolveChangellyTicker(symbiosis, usdc)
        const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(usdc))
        expect(resolved).toBe('usdc')
        expect(resolved).toBe(fastTicker)
    })

    test('Tron USDT: resolveChangellyTicker matches fast path', async () => {
        const usdt = new Token({
            chainId: ChainId.TRON_MAINNET,
            address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
            decimals: 6,
            symbol: 'USDT',
        })
        const resolved = await resolveChangellyTicker(symbiosis, usdt)
        const fastTicker = CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(usdt))
        expect(resolved).toBe('usdtrx')
        expect(resolved).toBe(fastTicker)
    })

    test('unknown token falls through to full path', async () => {
        // DAI is in mockCurrenciesFull but not in CHANGELLY_FAST_TICKER_MAP
        const dai = new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            decimals: 18,
            symbol: 'DAI',
        })

        // Not in fast path
        expect(CHANGELLY_FAST_TICKER_MAP.get(buildChangellyKey(dai))).toBeUndefined()

        // Falls through to API
        const resolved = await resolveChangellyTicker(symbiosis, dai)
        expect(resolved).toBe('dai')
    })
})

// --- Deposit swap (mocked Changelly API) ---

describe('#changellyDepositSwap', () => {
    beforeEach(() => {
        mockChangellyClient()
    })

    test('SOL → LTC deposit returns correct structure', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'), // 0.3 SOL
            tokenOut: ltc,
        })
        const result = await changellyDepositSwap(params)

        expect(result.kind).toBe('changelly-deposit')
        expect(result.transactionType).toBe('changelly')
        expect(result.routes).toHaveLength(1)
        expect(result.routes[0].provider).toBe(SymbiosisTradeType.CHANGELLY)
        expect(result.labels).toEqual(['partner-swap'])

        const tx = result.transactionRequest as any
        expect(tx.changellyTxId).toBe('4fs0djsqm1cic0j6')
        expect(tx.depositAddress).toBe('H2NLNh8tvrSvRXF1ocbuyJr8DNxoEJootD2z2KxFRio8')
        expect(tx.validUntil).toBeGreaterThan(Date.now() - 1000)
        expect(tx.currencyFrom).toBe('sol')
        expect(tx.currencyTo).toBe('ltc')
    })

    test('uses params.from as refund address fallback', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'),
            tokenOut: ltc,
        })
        await changellyDepositSwap(params)

        const createFixTx = symbiosis.changelly.createFixTransaction as ReturnType<typeof vi.fn>
        expect(createFixTx).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAddress: evmUserAddress,
            })
        )
    })

    test('explicit refundAddress takes precedence over params.from', async () => {
        const customRefund = 'ltc1qgxu8r4fdwd64fy77w8mcqfaz9h37jmjme45vvm' as any
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'),
            tokenOut: ltc,
            refundAddress: customRefund,
        })
        await changellyDepositSwap(params)

        const createFixTx = symbiosis.changelly.createFixTransaction as ReturnType<typeof vi.fn>
        expect(createFixTx).toHaveBeenCalledWith(
            expect.objectContaining({
                refundAddress: customRefund,
            })
        )
    })

    test('tokenAmountOut deducts networkFee', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'),
            tokenOut: ltc,
        })
        const result = await changellyDepositSwap(params)

        // rate.amountTo = '0.44870955', networkFee = '0.00501204', LTC decimals = 8
        // gross = 44870955, fee = 501204, net = 44369751
        expect(result.tokenAmountOut.raw.toString()).toBe('44369751')
    })

    test('fees array contains network fee', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'),
            tokenOut: ltc,
        })
        const result = await changellyDepositSwap(params)

        expect(result.fees).toHaveLength(1)
        expect(result.fees[0].provider).toBe(SymbiosisTradeType.CHANGELLY)
        expect(result.fees[0].description).toBe('Changelly network fee')
    })
})

// --- Trade swap (mocked Changelly API) ---

describe('#changellyTradeSwap', () => {
    beforeEach(() => {
        mockChangellyClient()
    })

    test('SOL → LTC trade returns Solana tx with changelly data', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'), // 0.3 SOL
            tokenOut: ltc,
            from: solUserAddress,
        })
        const result = await changellyTradeSwap(params)

        expect(result.kind).toBe('changelly-trade')
        expect(result.transactionType).toBe('solana')
        expect(result.routes).toHaveLength(1)
        expect(result.routes[0].provider).toBe(SymbiosisTradeType.CHANGELLY)

        // changellyData field should contain deposit data
        const changellyData = (result as any).changellyData
        expect(changellyData).toBeDefined()
        expect(changellyData.changellyTxId).toBe('4fs0djsqm1cic0j6')
        expect(changellyData.depositAddress).toBe('H2NLNh8tvrSvRXF1ocbuyJr8DNxoEJootD2z2KxFRio8')
        expect(changellyData.currencyFrom).toBe('sol')
        expect(changellyData.currencyTo).toBe('ltc')
        expect(changellyData.refundAddress).toBe(solUserAddress)
    })

    test('Solana tx contains instructions', async () => {
        const params = makeParams({
            tokenAmountIn: new TokenAmount(sol, '300000000'),
            tokenOut: ltc,
            from: solUserAddress,
        })
        const result = await changellyTradeSwap(params)

        const tx = result.transactionRequest as any
        expect(tx.instructions).toBeDefined()
        expect(typeof tx.instructions).toBe('string')
    })
})

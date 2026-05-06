import { describe, expect, test, vi, beforeEach } from 'vitest'
import { ChainId } from '../../../../src/constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../../../src/entities'

vi.mock('../../../../src/crosschain/api/thorchain', () => ({
    thorchainApi: {
        thorchain: {
            quoteswap: vi.fn(),
            inboundAddresses: vi.fn(),
        },
    },
}))

import { thorchainApi } from '../../../../src/crosschain/api/thorchain'
import { thorChainDepositSwap } from '../../../../src/crosschain/swapExactIn/swapThorChain/thorChainDepositSwap'

const ETH_USDC = new Token({
    chainId: ChainId.ETH_MAINNET,
    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    symbol: 'USDC',
    name: 'USD Coin',
    icons: { large: '', small: '' },
})

describe('thorChainDepositSwap', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    test('returns inbound_address + memo for LTC → BTC', async () => {
        ;(thorchainApi.thorchain.quoteswap as any).mockResolvedValue({
            inbound_address: 'ltc1qmockinboundaddress',
            memo: '=:BTC.BTC:bc1qrecipient:0/1/0',
            expected_amount_out: '99000000', // 1e8 thor units
            fees: { total: '1000000' },
            router: undefined,
            expiry: 9_999_999_999,
            dust_threshold: '10000',
            recommended_min_amount_in: '1000000',
        })

        const tokenAmountIn = new TokenAmount(GAS_TOKEN[ChainId.LTC_MAINNET], '100000000') // 1 LTC
        const tokenOut = GAS_TOKEN[ChainId.BTC_MAINNET]

        const result = await thorChainDepositSwap({
            symbiosis: { cache: { get: (_keys: any, fn: any) => fn() } } as any,
            tokenAmountIn,
            tokenOut,
            from: 'ltc1qsource',
            to: 'bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46',
            slippage: 100,
            deadline: 0,
            selectMode: 'best_return',
        } as any)

        expect(result.kind).toBe('thorchain-deposit')
        expect(result.transactionType).toBe('thorchain')
        if (result.transactionType !== 'thorchain') return
        expect(result.transactionRequest.inboundAddress).toBe('ltc1qmockinboundaddress')
        expect(result.transactionRequest.memo).toBe('=:BTC.BTC:bc1qrecipient:0/1/0')
        expect(result.tokenAmountOut.token.equals(tokenOut)).toBe(true)
        expect(result.tokenAmountOut.raw.toString()).toBe('99000000') // BTC also 8 decimals → same number
    })

    test('returns inbound_address + memo for LTC → ETH USDC', async () => {
        ;(thorchainApi.thorchain.quoteswap as any).mockResolvedValue({
            inbound_address: 'ltc1qmockinboundaddress',
            memo: '=:ETH.USDC-0XA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48:0xUserEvm:0/1/0',
            expected_amount_out: '9500000', // 1e8 thor units → USDC has 6 decimals → 95 USDC
            fees: { total: '500000' },
            router: '0xRouter',
            expiry: 9_999_999_999,
            dust_threshold: '10000',
            recommended_min_amount_in: '1000000',
        })

        const tokenAmountIn = new TokenAmount(GAS_TOKEN[ChainId.LTC_MAINNET], '100000000') // 1 LTC

        const result = await thorChainDepositSwap({
            symbiosis: { cache: { get: (_: any, fn: any) => fn() } } as any,
            tokenAmountIn,
            tokenOut: ETH_USDC,
            from: 'ltc1qsource',
            to: '0x0000000000000000000000000000000000000001',
            slippage: 100,
            deadline: 0,
            selectMode: 'best_return',
        } as any)

        expect(result.transactionType).toBe('thorchain')
        if (result.transactionType !== 'thorchain') return
        // 9_500_000 thor 1e8 units → 95_000 raw 1e6 USDC (divided by 100)
        expect(result.tokenAmountOut.raw.toString()).toBe('95000')
        expect(result.tokenAmountOut.token.equals(ETH_USDC)).toBe(true)
    })

    test('rejects DOGE → BTC when destination address is invalid', async () => {
        ;(thorchainApi.thorchain.quoteswap as any).mockResolvedValue({
            inbound_address: 'doge-inbound',
            memo: '=:BTC.BTC:bc1q:0/1/0',
            expected_amount_out: '0',
            fees: { total: '0' },
        })

        const tokenAmountIn = new TokenAmount(GAS_TOKEN[ChainId.DOGE_MAINNET], '100000000')
        const tokenOut = GAS_TOKEN[ChainId.BTC_MAINNET]

        await expect(
            thorChainDepositSwap({
                symbiosis: { cache: { get: (_: any, fn: any) => fn() } } as any,
                tokenAmountIn,
                tokenOut,
                from: 'DSourceDogecoinAddrXXXXXXXXXXXXXXX',
                to: 'not-a-bitcoin-address',
                slippage: 100,
                deadline: 0,
                selectMode: 'best_return',
            } as any)
        ).rejects.toThrow(/Bitcoin address/i)
    })

    test('throws when quoteswap omits inbound_address', async () => {
        ;(thorchainApi.thorchain.quoteswap as any).mockResolvedValue({
            memo: '=:BTC.BTC:bc1q:0/1/0',
            expected_amount_out: '0',
            fees: { total: '0' },
        })

        const tokenAmountIn = new TokenAmount(GAS_TOKEN[ChainId.LTC_MAINNET], '100000000')
        const tokenOut = GAS_TOKEN[ChainId.BTC_MAINNET]

        await expect(
            thorChainDepositSwap({
                symbiosis: { cache: { get: (_: any, fn: any) => fn() } } as any,
                tokenAmountIn,
                tokenOut,
                from: 'ltc1qsource',
                to: 'bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46',
                slippage: 100,
                deadline: 0,
                selectMode: 'best_return',
            } as any)
        ).rejects.toThrow(/inbound_address/i)
    })
})

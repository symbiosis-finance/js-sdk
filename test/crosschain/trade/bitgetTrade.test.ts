import { BigNumber } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { BitgetTrade } from '../../../src/crosschain/trade/bitgetTrade'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'

describe('BitgetTrade', () => {
    describe('isAvailable', () => {
        test('supported EVM chains', () => {
            expect(BitgetTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.MATIC_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.AVAX_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.MORPH_MAINNET)).toBe(true)
            expect(BitgetTrade.isAvailable(ChainId.HYPERLIQUID_MAINNET)).toBe(true)
        })

        test('unsupported chains (Solana market is not wired up)', () => {
            expect(BitgetTrade.isAvailable(ChainId.SOLANA_MAINNET)).toBe(false)
            expect(BitgetTrade.isAvailable(ChainId.TRON_MAINNET)).toBe(false)
        })
    })

    describe('tradeType', () => {
        const tokenIn = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDC',
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
        })
        const tokenOut = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDT',
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
        })
        const trade = new BitgetTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: { bitgetConfig: { apiUrl: '', apiKey: 'k', apiSecret: 's' } } as any,
        })

        test('returns bitget', () => {
            expect(trade.tradeType).toEqual('bitget')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })

        test('throws on unsupported chain', () => {
            const tonToken = new Token({
                chainId: ChainId.TON_MAINNET,
                symbol: 'TON',
                address: '',
                decimals: 9,
                isNative: true,
            })
            expect(
                () =>
                    new BitgetTrade({
                        tokenAmountIn: new TokenAmount(tonToken, '1000000000'),
                        tokenAmountInMin: new TokenAmount(tonToken, '900000000'),
                        tokenOut,
                        to: '0x1111111111111111111111111111111111111111',
                        from: '0x2222222222222222222222222222222222222222',
                        slippage: 100,
                        symbiosis: { bitgetConfig: { apiUrl: '', apiKey: 'k', apiSecret: 's' } } as any,
                    })
            ).toThrowError('Unsupported chain')
        })

        test('throws when API key/secret missing', () => {
            expect(
                () =>
                    new BitgetTrade({
                        tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
                        tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
                        tokenOut,
                        to: '0x1111111111111111111111111111111111111111',
                        from: '0x2222222222222222222222222222222222222222',
                        slippage: 100,
                        symbiosis: { bitgetConfig: { apiUrl: '', apiKey: '', apiSecret: '' } } as any,
                    })
            ).toThrowError('API key/secret is not set')
        })
    })

    describe('sign', () => {
        test('HMAC-SHA256 over alphabetically-sorted content matches a known value', () => {
            const body = JSON.stringify({ fromAmount: '100', fromChain: 'eth' })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const signature = (BitgetTrade as any).sign(
                '/bgw-pro/swapx/pro/quote',
                body,
                'test-key',
                'test-secret',
                '1700000000000'
            )
            expect(signature).toBe('tHCUm/plUgm+VLCqpXzNIGBoQg5t2kqI9ttXVFD45rY=')
        })
    })

    describe('findValueOffset', () => {
        test('finds a value embedded in calldata', () => {
            const value = BigNumber.from('123456789012345678')
            const callData =
                '0x' + 'aabbccdd' + '0'.repeat(64) + value.toHexString().slice(2).padStart(64, '0') + '0'.repeat(64)
            const offset = BitgetTrade.findValueOffset(callData, value.toString())

            expect(offset).toBeGreaterThan(0)
            expect(SymbiosisTrade.getAmountFromCallData(callData, offset)).toEqual(value)
        })

        test('returns 0 for zero value', () => {
            expect(BitgetTrade.findValueOffset('0x' + '00'.repeat(64), '0')).toBe(0)
        })

        test('returns 0 when value not found', () => {
            const callData = '0x' + 'ff'.repeat(64)
            expect(BitgetTrade.findValueOffset(callData, '42')).toBe(0)
        })

        test('found offset is patchable', () => {
            const amount = BigNumber.from('999888777666')
            const padding = '0'.repeat(128)
            const callData = '0xdeadbeef' + padding + amount.toHexString().slice(2).padStart(64, '0') + padding
            const offset = BitgetTrade.findValueOffset(callData, amount.toString())

            const newAmount = BigNumber.from('500000000000')
            const patched = SymbiosisTrade.patchCallData(callData, offset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, offset)).toEqual(newAmount)
        })
    })
})

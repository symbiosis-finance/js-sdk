import { BigNumber } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { FlyTrade } from '../../../src/crosschain/trade/flyTrade'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'

describe('FlyTrade', () => {
    describe('isAvailable', () => {
        test('supported chains', () => {
            expect(FlyTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(FlyTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(FlyTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(FlyTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
        })

        test('unsupported chains', () => {
            expect(FlyTrade.isAvailable(ChainId.TRON_MAINNET)).toBe(false)
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
        const trade = new FlyTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: {} as any,
        })

        test('returns fly', () => {
            expect(trade.tradeType).toEqual('fly')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    describe('findValueOffset', () => {
        test('finds a value embedded in calldata', () => {
            const value = BigNumber.from('123456789012345678')
            const callData =
                '0x' + 'aabbccdd' + '0'.repeat(64) + value.toHexString().slice(2).padStart(64, '0') + '0'.repeat(64)
            const offset = FlyTrade.findValueOffset(callData, value.toString())

            expect(offset).toBeGreaterThan(0)
            expect(SymbiosisTrade.getAmountFromCallData(callData, offset)).toEqual(value)
        })

        test('returns 0 for zero value', () => {
            expect(FlyTrade.findValueOffset('0x' + '00'.repeat(64), '0')).toBe(0)
        })

        test('returns 0 when value not found', () => {
            const callData = '0x' + 'ff'.repeat(64)
            expect(FlyTrade.findValueOffset(callData, '42')).toBe(0)
        })

        test('found offset is patchable round-trip', () => {
            const fromAmount = BigNumber.from('999888777666')
            const padding = '0'.repeat(128)
            const callData =
                '0xdeadbeef' + padding + fromAmount.toHexString().slice(2).padStart(64, '0') + padding
            const offset = FlyTrade.findValueOffset(callData, fromAmount.toString())

            const newAmount = BigNumber.from('500000000000')
            const patched = SymbiosisTrade.patchCallData(callData, offset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, offset)).toEqual(newAmount)
        })
    })
})

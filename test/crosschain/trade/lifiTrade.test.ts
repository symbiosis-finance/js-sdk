import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { LifiTrade } from '../../../src/crosschain/trade/lifiTrade'

describe('LifiTrade', () => {
    describe('isAvailable', () => {
        test('supported chains', () => {
            expect(LifiTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
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
        const trade = new LifiTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: {} as any,
        })

        test('returns lifi', () => {
            expect(trade.tradeType).toEqual('lifi')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })
})

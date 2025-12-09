import { BigNumber } from 'ethers'
import { describe, expect, test, vi } from 'vitest'

import { ChainId, Symbiosis, Token, TokenAmount } from '../../../src'
import { OpenOceanTrade } from '../../../src/crosschain/trade'
import type { OpenOceanQuote } from '../../../src/crosschain/trade/openOceanTrade'

describe('OpenOceanTrade', () => {
    const symbiosis = new Symbiosis('mainnet', 'test')

    const tokenIn = new Token({
        chainId: ChainId.ETH_MAINNET,
        symbol: 'USDT',
        address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimals: 6,
    })
    const tokenOut = new Token({
        chainId: ChainId.ETH_MAINNET,
        symbol: 'USDC',
        address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        decimals: 6,
    })
    const amountIn = BigNumber.from(100).mul(BigNumber.from(10).pow(tokenIn.decimals))
    const amountInMin = BigNumber.from(90).mul(BigNumber.from(10).pow(tokenIn.decimals))
    const tokenAmountIn = new TokenAmount(tokenIn, amountIn.toString())
    const tokenAmountInMin = new TokenAmount(tokenIn, amountInMin.toString())
    const to = '0x1111111111111111111111111111111111111111'
    const slippage = 100

    describe('Not initialized trade', () => {
        const trade = new OpenOceanTrade({
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            to,
            slippage,
            symbiosis,
        })
        test('tradeType', () => {
            expect(trade.tradeType).toEqual('open-ocean')
        })
        test('amountOut', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    const initializedTrade = async (): Promise<OpenOceanTrade> => {
        const trade = new OpenOceanTrade({
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            to,
            slippage,
            symbiosis,
        })
        await trade.init()
        return trade
    }

    describe('mocked', () => {
        const quote: OpenOceanQuote = {
            to: '0x1111111111111111111111111111111111111111',
            inAmount: '10000000',
            outAmount: '9000000',
            data: '0x90411a32', // swap
            price_impact: '0.83%',
        }
        const mockQuote = vi.spyOn(OpenOceanTrade.prototype, 'request').mockResolvedValue(quote)

        describe('Initialized', async () => {
            const trade = await initializedTrade()
            test('mockQuote', () => {
                expect(mockQuote).toHaveBeenCalled()
            })
            test('amountOut', () => {
                const expectedAmountOut = new TokenAmount(tokenOut, '9000000')
                expect(trade.amountOut).toEqual(expectedAmountOut)
            })
            test('amountOutMin', () => {
                // 9000000 * 0.99 (slippage)
                const expectedAmountOut = new TokenAmount(tokenOut, '8910000')
                expect(trade.amountOutMin.raw.toString()).toEqual(expectedAmountOut.raw.toString())
            })
        })
    })
})

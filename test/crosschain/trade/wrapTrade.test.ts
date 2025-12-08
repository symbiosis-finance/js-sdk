import { describe, expect, test, vi } from 'vitest'

import { Token, TokenAmount, wrappedToken } from '../../../src'
import { WrapTrade } from '../../../src/crosschain/trade'

describe('WrapTrade', () => {
    describe('WRAP', () => {
        const eth = new Token({ chainId: 1, address: '', decimals: 18, isNative: true })
        const tokenAmountIn = new TokenAmount(eth, '100')
        const tokenAmountInMin = new TokenAmount(eth, '90')
        const tokenOut = wrappedToken(eth)
        const to = '0x1111111111111111111111111111111111111111'

        describe('Not initialized trade', () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            test('tradeType', () => {
                expect(trade.tradeType).toEqual('wrap')
            })
            test('amountOut', () => {
                expect(() => trade.amountOut).toThrowError()
            })
        })

        describe('Initialized', async () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            await trade.init()

            test('amountOut', () => {
                const getAmountOut = vi.fn(() => trade.amountOut)
                const amountOut = getAmountOut()
                const expectedAmountOut = new TokenAmount(tokenOut, '100')
                expect(amountOut.equalTo(expectedAmountOut)).toBeTruthy()
                expect(getAmountOut).toHaveReturned()
            })

            test('amountOutMin', () => {
                const getAmountOutMin = vi.fn(() => trade.amountOutMin)
                const amountOutMin = getAmountOutMin()
                const expectedAmountOutMin = new TokenAmount(tokenOut, '90')
                expect(amountOutMin.equalTo(expectedAmountOutMin)).toBeTruthy()
                expect(getAmountOutMin).toHaveReturned()
            })

            test('calldata', () => {
                expect(trade.callData).toEqual('0xd0e30db0')
            })
            test('callDataOffset', () => {
                expect(trade.callDataOffset).toEqual(0)
            })
            test('minReceivedOffset', () => {
                expect(trade.minReceivedOffset).toEqual(0)
            })
        })

        describe('Patched', async () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            await trade.init()

            const newAmountIn = new TokenAmount(tokenAmountIn.token, '90')
            const newAmountInMin = new TokenAmount(tokenAmountIn.token, '80')
            await trade.applyAmountIn(newAmountIn, newAmountInMin)

            test('amountIn', () => {
                expect(trade.tokenAmountIn.equalTo(newAmountIn)).toBeTruthy()
            })

            test('amountInMin', () => {
                expect(trade.tokenAmountInMin.equalTo(newAmountInMin)).toBeTruthy()
            })

            test('amountOut', () => {
                const getAmountOut = vi.fn(() => trade.amountOut)
                const amountOut = getAmountOut()
                const expectedAmountOut = new TokenAmount(tokenOut, '90')
                expect(amountOut.equalTo(expectedAmountOut)).toBeTruthy()
                expect(getAmountOut).toHaveReturned()
            })

            test('amountOutMin', () => {
                const getAmountOutMin = vi.fn(() => trade.amountOutMin)
                const amountOutMin = getAmountOutMin()
                const expectedAmountOutMin = new TokenAmount(tokenOut, '80')
                expect(amountOutMin.equalTo(expectedAmountOutMin)).toBeTruthy()
                expect(getAmountOutMin).toHaveReturned()
            })

            test('calldata', () => {
                expect(trade.callData).toEqual('0xd0e30db0')
            })
        })
    })

    describe('UNWRAP', () => {
        const tokenOut = new Token({ chainId: 1, address: '', decimals: 18, isNative: true })
        const weth = wrappedToken(tokenOut)
        const tokenAmountIn = new TokenAmount(weth, '100')
        const tokenAmountInMin = new TokenAmount(weth, '90')
        const to = '0x1111111111111111111111111111111111111111'

        describe('Not initialized trade', () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            test('tradeType', () => {
                expect(trade.tradeType).toEqual('wrap')
            })
            test('amountOut', () => {
                expect(() => trade.amountOut).toThrowError()
            })
        })

        describe('Initialized', async () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            await trade.init()

            test('amountOut', () => {
                const getAmountOut = vi.fn(() => trade.amountOut)
                const amountOut = getAmountOut()
                const expectedAmountOut = new TokenAmount(tokenOut, '100')
                expect(amountOut.equalTo(expectedAmountOut)).toBeTruthy()
                expect(getAmountOut).toHaveReturned()
            })

            test('amountOutMin', () => {
                const getAmountOutMin = vi.fn(() => trade.amountOutMin)
                const amountOutMin = getAmountOutMin()
                const expectedAmountOutMin = new TokenAmount(tokenOut, '90')
                expect(amountOutMin.equalTo(expectedAmountOutMin)).toBeTruthy()
                expect(getAmountOutMin).toHaveReturned()
            })

            test('calldata', () => {
                expect(trade.callData).toEqual(
                    '0x7647691d00000000000000000000000000000000000000000000000000000000000000640000000000000000000000001111111111111111111111111111111111111111'
                )
            })
            test('callDataOffset', () => {
                expect(trade.callDataOffset).toEqual(36)
            })
            test('minReceivedOffset', () => {
                expect(trade.minReceivedOffset).toEqual(0)
            })
        })

        describe('Patched', async () => {
            const trade = new WrapTrade({
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
            })
            await trade.init()

            const newAmountIn = new TokenAmount(tokenAmountIn.token, '90')
            const newAmountInMin = new TokenAmount(tokenAmountIn.token, '80')
            await trade.applyAmountIn(newAmountIn, newAmountInMin)

            test('amountIn', () => {
                expect(trade.tokenAmountIn.equalTo(newAmountIn)).toBeTruthy()
            })

            test('amountInMin', () => {
                expect(trade.tokenAmountInMin.equalTo(newAmountInMin)).toBeTruthy()
            })

            test('amountOut', () => {
                const getAmountOut = vi.fn(() => trade.amountOut)
                const amountOut = getAmountOut()
                const expectedAmountOut = new TokenAmount(tokenOut, '90')
                expect(amountOut.equalTo(expectedAmountOut)).toBeTruthy()
                expect(getAmountOut).toHaveReturned()
            })

            test('amountOutMin', () => {
                const getAmountOutMin = vi.fn(() => trade.amountOutMin)
                const amountOutMin = getAmountOutMin()
                const expectedAmountOutMin = new TokenAmount(tokenOut, '80')
                expect(amountOutMin.equalTo(expectedAmountOutMin)).toBeTruthy()
                expect(getAmountOutMin).toHaveReturned()
            })

            test('calldata', () => {
                expect(trade.callData).toEqual(
                    '0x7647691d000000000000000000000000000000000000000000000000000000000000005a0000000000000000000000001111111111111111111111111111111111111111'
                )
            })
        })
    })
})

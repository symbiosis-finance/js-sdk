import { describe, expect, test, vi } from 'vitest'
import { OctoPoolTrade } from '../../../src/crosschain/trade'
import { Symbiosis, TokenAmount } from '../../../src'
import { BigNumber } from 'ethers'

const DECIMALS = BigNumber.from(10).pow(18)

describe('OctoPoolTrade', () => {
    const symbiosis = new Symbiosis('mainnet', 'test')
    const omniPoolConfig = symbiosis.config.omniPools[0]
    const tokens = symbiosis.getOmniPoolTokens(omniPoolConfig)

    const amountIn = BigNumber.from(100).mul(DECIMALS)
    const amountInMin = BigNumber.from(90).mul(DECIMALS)

    const tokenIn = tokens[0]
    const tokenAmountIn = new TokenAmount(tokenIn, amountIn.toString())
    const tokenAmountInMin = new TokenAmount(tokenIn, amountInMin.toString())
    const tokenOut = tokens[1]
    const to = '0x1111111111111111111111111111111111111111'
    const slippage = 100
    const deadline = Math.floor(Date.now() / 1000) + 3600

    describe('Not initialized trade', () => {
        const trade = new OctoPoolTrade({
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            to,
            slippage,
            symbiosis,
            omniPoolConfig,
            deadline,
        })
        test('tradeType', () => {
            expect(trade.tradeType).toEqual('octopool')
        })
        test('amountOut', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    const initializedTrade = async (): Promise<OctoPoolTrade> => {
        const trade = new OctoPoolTrade({
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            to,
            slippage,
            symbiosis,
            omniPoolConfig,
            deadline,
        })
        await trade.init()
        return trade
    }
    const quote = BigNumber.from('80').mul(DECIMALS)
    const mockQuote = vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)

    describe('Initialized', async () => {
        const trade = await initializedTrade()
        test('mockQuote', () => {
            expect(mockQuote).toHaveBeenCalled()
        })
        test('amountOut', () => {
            const expectedAmountOut = new TokenAmount(tokenOut, '80000000000000000000')
            expect(trade.amountOut).toEqual(expectedAmountOut)
        })
        test('amountOutMin', () => {
            // 80 * (90/100) * 0.99 (slippage)
            const expectedAmountOut = new TokenAmount(tokenOut, '71280000000000000000')
            expect(trade.amountOutMin.raw.toString()).toEqual(expectedAmountOut.raw.toString())
        })

        test('calldata', () => {
            const deadlineHex = deadline.toString(16).padStart(64, '0')
            const dataWithoutDeadline =
                '0x8f6bdeaa000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000056bc75e2d63100000000000000000000000000000000000000000000000000003dd356e57a5d800000000000000000000000000001111111111111111111111111111111111111111'
            const data = dataWithoutDeadline + deadlineHex
            expect(trade.callData).toEqual(data)
            // includes amountIn 100000000000000000000
            expect(data.includes('56BC75E2D63100000'.toLowerCase())).toBeTruthy()
            // includes minReceived 71280000000000000000
            expect(data.includes('3DD356E57A5D80000'.toLowerCase())).toBeTruthy()
        })
        test('callDataOffset', () => {
            expect(trade.callDataOffset).toEqual(100)
        })
        test('minReceivedOffset', () => {
            expect(trade.minReceivedOffset).toEqual(132)
        })
    })

    describe('Patched', async () => {
        const trade = await initializedTrade()

        // was 100, now 50
        const newAmountInRaw = BigNumber.from(50).mul(DECIMALS)
        const newAmountIn = new TokenAmount(tokenAmountIn.token, newAmountInRaw.toString())
        trade.applyAmountIn(newAmountIn)

        test('amountIn', () => {
            expect(trade.tokenAmountIn.equalTo(newAmountIn)).toBeTruthy()
        })

        test('amountOut', () => {
            // 80 * (50/100)
            expect(trade.amountOut.raw.toString()).toEqual('40000000000000000000')
        })
        test('amountOutMin', () => {
            // 71.28 * (50/100)
            expect(trade.amountOutMin.raw.toString()).toEqual('35640000000000000000')
        })

        test('calldata', () => {
            const deadlineHex = deadline.toString(16).padStart(64, '0')
            const dataWithoutDeadline =
                '0x8f6bdeaa00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000002b5e3af16b1880000000000000000000000000000000000000000000000000001ee9ab72bd2ec00000000000000000000000000001111111111111111111111111111111111111111'
            const data = dataWithoutDeadline + deadlineHex

            expect(trade.callData).toEqual(data)
            // includes amountIn 50000000000000000000
            expect(data.includes('2B5E3AF16B1880000'.toLowerCase())).toBeTruthy()
            // includes minReceived 35640000000000000000
            expect(data.includes('1EE9AB72BD2EC0000'.toLowerCase())).toBeTruthy()
        })
    })
})

import { describe, expect, test, vi } from 'vitest'
import { ChainId, Symbiosis, Token, TokenAmount } from '../../src'
import { BigNumber } from 'ethers'
import { Transit } from '../../src/crosschain/transit'
import { OctoPoolTrade } from '../../src/crosschain/trade'

const DECIMALS = BigNumber.from(10).pow(18)

describe('Transit#noExtraFee', async () => {
    const symbiosis = new Symbiosis('mainnet', 'test')
    const omniPoolConfig = symbiosis.config.omniPools[0]

    const amountIn = BigNumber.from(100).mul(DECIMALS)
    const amountInMin = BigNumber.from(90).mul(DECIMALS)

    const tokenIn = new Token({
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.ETH_MAINNET,
    })
    const tokenAmountIn = new TokenAmount(tokenIn, amountIn.toString())
    const tokenAmountInMin = new TokenAmount(tokenIn, amountInMin.toString())
    const tokenOut = new Token({
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        symbol: 'USDC',
        decimals: 6,
        chainId: ChainId.BSC_MAINNET,
    })
    const slippage = 100
    const deadline = Math.floor(Date.now() / 1000) + 3600

    const tradeTokenOut = new Token({
        decimals: 18,
        symbol: 'sUSDC',
        name: 'Synthetic Binance-Peg USD Coin from BSC',
        chainId: 56288,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        },
        chainFromId: 56,
        address: '0x5e19eFc6AC9C80bfAA755259c9fab2398A8E87eB',
    })
    const tradeTokenIn = new Token({
        decimals: 6,
        symbol: 'sUSDC',
        name: 'Synthetic USD Coin from Ethereum',
        chainId: 56288,
        icons: {
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        },
        chainFromId: 1,
        address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
    })

    describe('constructor', () => {
        const trade = new Transit(
            symbiosis,
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            slippage,
            deadline,
            omniPoolConfig
        )

        test('direction', () => {
            expect(trade.direction).toEqual('v2')
        })
        test('isV2', () => {
            expect(trade.isV2()).toBeTruthy()
        })
        test('feeToken1', () => {
            expect(trade.feeToken1).toEqual(
                new Token({
                    decimals: 6,
                    symbol: 'sUSDC',
                    name: 'Synthetic USD Coin from Ethereum',
                    chainId: 56288,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                    },
                    chainFromId: 1,
                    address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
                })
            )
        })
        test('feeToken2', () => {
            expect(trade.feeToken2).toEqual(
                new Token({
                    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
                    symbol: 'USDC',
                    decimals: 6,
                    chainId: ChainId.BSC_MAINNET,
                })
            )
        })
        test('calls', () => {
            expect(trade.calls()).toBeUndefined()
        })
        test('getBridgeAmountIn', () => {
            expect(trade.getBridgeAmountIn()).toEqual(tokenAmountIn)
        })
    })

    const initializedTransit = async (fee1?: TokenAmount, fee2?: TokenAmount): Promise<Transit> => {
        const transit = new Transit(
            symbiosis,
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            slippage,
            deadline,
            omniPoolConfig,
            fee1,
            fee2
        )
        await transit.init()

        return transit
    }

    describe('Initialized', async () => {
        const quote = BigNumber.from('80').mul(DECIMALS)
        const mockQuote = vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)
        const transit = await initializedTransit()
        test('mockQuote', () => {
            expect(mockQuote).toHaveBeenCalledOnce()
        })
        test('amountOut', () => {
            const expectedAmountOut = new TokenAmount(tokenOut, '80000000000000000000')
            expect(transit.amountOut).toEqual(expectedAmountOut)
        })
        test('amountOutMin', () => {
            // 80 * (90/100) * 0.99 (slippage)
            const expectedAmountOut = new TokenAmount(tokenOut, '71280000000000000000')
            expect(transit.amountOutMin.raw.toString()).toEqual(expectedAmountOut.raw.toString())
        })
        test('calls', () => {
            expect(transit.calls()).toBeDefined()
            expect(transit.calls()?.calldatas.length).toEqual(1)
        })
    })

    describe('With fees set', async () => {
        const feeToken1 = new Token({
            decimals: 6,
            symbol: 'sUSDC',
            name: 'Synthetic USD Coin from Ethereum',
            chainId: 56288,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
            chainFromId: 1,
            address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
        })

        const fee1 = new TokenAmount(feeToken1, BigNumber.from('10').mul(DECIMALS).toString())
        const fee2 = new TokenAmount(tokenOut, BigNumber.from('20').mul(DECIMALS).toString())

        const quote = BigNumber.from('70').mul(DECIMALS)
        vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)
        const createOctoPoolTradeSpy = vi.spyOn(Transit.prototype, 'createOctoPoolTrade')

        const transit = await initializedTransit(fee1, fee2)

        test('createOctoPoolTradeSpy', () => {
            const multicallRouterOnHostChain = '0xcB28fbE3E9C0FEA62E0E63ff3f232CECfE555aD4'
            expect(createOctoPoolTradeSpy).toHaveBeenCalledWith({
                to: multicallRouterOnHostChain,
                tokenAmountIn: new TokenAmount(tradeTokenIn, '90000000000000000000'), // 100 - 10 (fee1)
                tokenAmountInMin: new TokenAmount(tradeTokenIn, '80000000000000000000'), // 90 - 10 (fee1)
                tokenOut: tradeTokenOut,
            })

            expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
            expect(transit.trade.amountOut.raw.toString()).toEqual('70000000000000000000')

            // 70 * (80/90) * 0.99 (slippage)
            expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
            expect(transit.trade.amountOutMin.raw.toString()).toEqual('61599999999999999999')
        })
        test('amountOut', () => {
            // 70 (mock quote) - 20 (fee2)
            const expectedAmountOut = new TokenAmount(tokenOut, '50000000000000000000')
            expect(transit.amountOut.raw.toString()).toEqual(expectedAmountOut.raw.toString())
        })
        test('amountOutMin', () => {
            // 61599999999999999999 - 20 (fee2)
            const expectedAmountOut = new TokenAmount(tokenOut, '41599999999999999999')
            expect(transit.amountOutMin.raw.toString()).toEqual(expectedAmountOut.raw.toString())
        })
    })

    describe('Patched', async () => {
        const quote = BigNumber.from('70').mul(DECIMALS)
        vi.spyOn(OctoPoolTrade.prototype, 'quote').mockResolvedValue(quote)
        const createOctoPoolTradeSpy = vi.spyOn(Transit.prototype, 'createOctoPoolTrade')

        const transit = await initializedTransit()

        test('createOctoPoolTradeSpy', () => {
            const multicallRouterOnHostChain = '0xcB28fbE3E9C0FEA62E0E63ff3f232CECfE555aD4'

            expect(createOctoPoolTradeSpy).toHaveBeenCalledWith({
                to: multicallRouterOnHostChain,
                tokenAmountIn: new TokenAmount(tradeTokenIn, '100000000000000000000'), // 100
                tokenAmountInMin: new TokenAmount(tradeTokenIn, '90000000000000000000'), // 90
                tokenOut: tradeTokenOut,
            })
        })

        describe('applyFees', () => {
            const fee1 = new TokenAmount(transit.feeToken1, BigNumber.from('10').mul(DECIMALS).toString())
            const fee2 = new TokenAmount(transit.feeToken2!, BigNumber.from('20').mul(DECIMALS).toString())
            const applyAmountInSpy = vi.spyOn(OctoPoolTrade.prototype, 'applyAmountIn')

            transit.applyFees(fee1, fee2)

            test('applyAmountInSpy', () => {
                expect(applyAmountInSpy).toHaveBeenCalledWith(new TokenAmount(tradeTokenIn, '90000000000000000000'))
            })

            test('trade amounts', () => {
                expect(transit.trade.amountOut.token).toEqual(tradeTokenOut)
                expect(transit.trade.amountOut.raw.toString()).toEqual('63000000000000000000')

                expect(transit.trade.amountOutMin.token).toEqual(tradeTokenOut)
                expect(transit.trade.amountOutMin.raw.toString()).toEqual('56133000000000000000')
            })
            test('calldata', () => {
                // includes amountIn 90000000000000000000
                expect(transit.trade.callData.includes('4E1003B28D9280000'.toLowerCase())).toBeTruthy()
                // includes minReceived 56133000000000000000
                expect(transit.trade.callData.includes('30B007A1839008000'.toLowerCase())).toBeTruthy()
            })
            // test('amountOut', () => {
            //     // 70 (mock quote) - 20 (fee2)
            //     const expectedAmountOut = new TokenAmount(tokenOut, '50000000000000000000')
            //     expect(transit.amountOut.raw.toString()).toEqual(expectedAmountOut.raw.toString())
            // })
            // test('amountOutMin', () => {
            //     // 61599999999999999999 - 20 (fee2)
            //     const expectedAmountOut = new TokenAmount(tokenOut, '41599999999999999999')
            //     expect(transit.amountOutMin.raw.toString()).toEqual(expectedAmountOut.raw.toString())
            // })
        })
    })
})

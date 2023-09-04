import JSBI from 'jsbi'
import { ChainId, Pair, Percent, Route, Token, TokenAmount, Trade, TradeType } from '../src'
import { describe, expect, test } from 'vitest'

describe('Trade', () => {
    const token0 = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x0000000000000000000000000000000000000001',
        decimals: 18,
        symbol: 't0',
    })
    const token1 = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x0000000000000000000000000000000000000002',
        decimals: 18,
        symbol: 't1',
    })
    const token2 = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x0000000000000000000000000000000000000003',
        decimals: 18,
        symbol: 't2',
    })
    const token3 = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x0000000000000000000000000000000000000004',
        decimals: 18,
        symbol: 't3',
    })

    const pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token1, JSBI.BigInt(1000)))
    const pair_0_2 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token2, JSBI.BigInt(1100)))
    const pair_0_3 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token3, JSBI.BigInt(900)))
    const pair_1_2 = new Pair(new TokenAmount(token1, JSBI.BigInt(1200)), new TokenAmount(token2, JSBI.BigInt(1000)))
    const pair_1_3 = new Pair(new TokenAmount(token1, JSBI.BigInt(1200)), new TokenAmount(token3, JSBI.BigInt(1300)))

    const empty_pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(0)), new TokenAmount(token1, JSBI.BigInt(0)))

    describe('#bestTradeExactIn', () => {
        test('throws with empty pairs', () => {
            expect(() => Trade.bestTradeExactIn([], new TokenAmount(token0, JSBI.BigInt(100)), token2)).toThrow('PAIRS')
        })
        test('throws with max hops of 0', () => {
            expect(() =>
                Trade.bestTradeExactIn([pair_0_2], new TokenAmount(token0, JSBI.BigInt(100)), token2, { maxHops: 0 })
            ).toThrow('MAX_HOPS')
        })

        test('provides best route', () => {
            const result = Trade.bestTradeExactIn(
                [pair_0_1, pair_0_2, pair_1_2],
                new TokenAmount(token0, JSBI.BigInt(100)),
                token2
            )
            expect(result).toHaveLength(2)
            expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
            expect(result[0].route.path).toEqual([token0, token2])
            expect(result[0].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(100)))
            expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(99)))
            expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
            expect(result[1].route.path).toEqual([token0, token1, token2])
            expect(result[1].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(100)))
            expect(result[1].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(69)))
        })

        test('doesnt throw for zero liquidity pairs', () => {
            expect(
                Trade.bestTradeExactIn([empty_pair_0_1], new TokenAmount(token0, JSBI.BigInt(100)), token1)
            ).toHaveLength(0)
        })

        test('respects maxHops', () => {
            const result = Trade.bestTradeExactIn(
                [pair_0_1, pair_0_2, pair_1_2],
                new TokenAmount(token0, JSBI.BigInt(10)),
                token2,
                { maxHops: 1 }
            )
            expect(result).toHaveLength(1)
            expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
            expect(result[0].route.path).toEqual([token0, token2])
        })

        test('insufficient input for one pair', () => {
            const result = Trade.bestTradeExactIn(
                [pair_0_1, pair_0_2, pair_1_2],
                new TokenAmount(token0, JSBI.BigInt(1)),
                token2
            )
            expect(result).toHaveLength(1)
            expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
            expect(result[0].route.path).toEqual([token0, token2])
            expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(1)))
        })

        test('respects n', () => {
            const result = Trade.bestTradeExactIn(
                [pair_0_1, pair_0_2, pair_1_2],
                new TokenAmount(token0, JSBI.BigInt(10)),
                token2,
                { maxNumResults: 1 }
            )

            expect(result).toHaveLength(1)
        })

        test('no path', () => {
            const result = Trade.bestTradeExactIn(
                [pair_0_1, pair_0_3, pair_1_3],
                new TokenAmount(token0, JSBI.BigInt(10)),
                token2
            )
            expect(result).toHaveLength(0)
        })
    })

    describe('#maximumAmountIn', () => {
        describe('tradeType = EXACT_INPUT', () => {
            const exactIn = new Trade(
                new Route([pair_0_1, pair_1_2], token0),
                new TokenAmount(token0, JSBI.BigInt(100)),
                TradeType.EXACT_INPUT
            )
            test('throws if less than 0', () => {
                expect(() => exactIn.maximumAmountIn(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
                    'SLIPPAGE_TOLERANCE'
                )
            })
            test('returns exact if 0', () => {
                expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    exactIn.inputAmount
                )
            })
            test('returns exact if nonzero', () => {
                expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(100))
                )
                expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(100))
                )
                expect(exactIn.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(100))
                )
            })
        })
        describe('tradeType = EXACT_OUTPUT', () => {
            const exactOut = new Trade(
                new Route([pair_0_1, pair_1_2], token0),
                new TokenAmount(token2, JSBI.BigInt(100)),
                TradeType.EXACT_OUTPUT
            )

            test('throws if less than 0', () => {
                expect(() => exactOut.maximumAmountIn(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
                    'SLIPPAGE_TOLERANCE'
                )
            })
            test('returns exact if 0', () => {
                expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    exactOut.inputAmount
                )
            })
            test('returns slippage amount if nonzero', () => {
                expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(156))
                )
                expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(163))
                )
                expect(exactOut.maximumAmountIn(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token0, JSBI.BigInt(468))
                )
            })
        })
    })

    describe('#minimumAmountOut', () => {
        describe('tradeType = EXACT_INPUT', () => {
            const exactIn = new Trade(
                new Route([pair_0_1, pair_1_2], token0),
                new TokenAmount(token0, JSBI.BigInt(100)),
                TradeType.EXACT_INPUT
            )
            test('throws if less than 0', () => {
                expect(() => exactIn.minimumAmountOut(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
                    'SLIPPAGE_TOLERANCE'
                )
            })
            test('returns exact if 0', () => {
                expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    exactIn.outputAmount
                )
            })
            test('returns exact if nonzero', () => {
                expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(69))
                )
                expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(65))
                )
                expect(exactIn.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(23))
                )
            })
        })
        describe('tradeType = EXACT_OUTPUT', () => {
            const exactOut = new Trade(
                new Route([pair_0_1, pair_1_2], token0),
                new TokenAmount(token2, JSBI.BigInt(100)),
                TradeType.EXACT_OUTPUT
            )

            test('throws if less than 0', () => {
                expect(() => exactOut.minimumAmountOut(new Percent(JSBI.BigInt(-1), JSBI.BigInt(100)))).toThrow(
                    'SLIPPAGE_TOLERANCE'
                )
            })
            test('returns exact if 0', () => {
                expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    exactOut.outputAmount
                )
            })
            test('returns slippage amount if nonzero', () => {
                expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(0), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(100))
                )
                expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(5), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(100))
                )
                expect(exactOut.minimumAmountOut(new Percent(JSBI.BigInt(200), JSBI.BigInt(100)))).toEqual(
                    new TokenAmount(token2, JSBI.BigInt(100))
                )
            })
        })
    })

    describe('#bestTradeExactOut', () => {
        test('throws with empty pairs', () => {
            expect(() => Trade.bestTradeExactOut([], token0, new TokenAmount(token2, JSBI.BigInt(100)))).toThrow(
                'PAIRS'
            )
        })
        test('throws with max hops of 0', () => {
            expect(() =>
                Trade.bestTradeExactOut([pair_0_2], token0, new TokenAmount(token2, JSBI.BigInt(100)), { maxHops: 0 })
            ).toThrow('MAX_HOPS')
        })

        test('provides best route', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_2, pair_1_2],
                token0,
                new TokenAmount(token2, JSBI.BigInt(100))
            )
            expect(result).toHaveLength(2)
            expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
            expect(result[0].route.path).toEqual([token0, token2])
            expect(result[0].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(101)))
            expect(result[0].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(100)))
            expect(result[1].route.pairs).toHaveLength(2) // 0 -> 1 -> 2 at 12:12:10
            expect(result[1].route.path).toEqual([token0, token1, token2])
            expect(result[1].inputAmount).toEqual(new TokenAmount(token0, JSBI.BigInt(156)))
            expect(result[1].outputAmount).toEqual(new TokenAmount(token2, JSBI.BigInt(100)))
        })

        test('doesnt throw for zero liquidity pairs', () => {
            expect(
                Trade.bestTradeExactOut([empty_pair_0_1], token1, new TokenAmount(token1, JSBI.BigInt(100)))
            ).toHaveLength(0)
        })

        test('respects maxHops', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_2, pair_1_2],
                token0,
                new TokenAmount(token2, JSBI.BigInt(10)),
                { maxHops: 1 }
            )
            expect(result).toHaveLength(1)
            expect(result[0].route.pairs).toHaveLength(1) // 0 -> 2 at 10:11
            expect(result[0].route.path).toEqual([token0, token2])
        })

        test('insufficient liquidity', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_2, pair_1_2],
                token0,
                new TokenAmount(token2, JSBI.BigInt(1200))
            )
            expect(result).toHaveLength(0)
        })

        test('insufficient liquidity in one pair but not the other', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_2, pair_1_2],
                token0,
                new TokenAmount(token2, JSBI.BigInt(1050))
            )
            expect(result).toHaveLength(1)
        })

        test('respects n', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_2, pair_1_2],
                token0,
                new TokenAmount(token2, JSBI.BigInt(10)),
                { maxNumResults: 1 }
            )

            expect(result).toHaveLength(1)
        })

        test('no path', () => {
            const result = Trade.bestTradeExactOut(
                [pair_0_1, pair_0_3, pair_1_3],
                token0,
                new TokenAmount(token2, JSBI.BigInt(10))
            )
            expect(result).toHaveLength(0)
        })
    })
})

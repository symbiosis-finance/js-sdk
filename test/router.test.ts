import invariant from 'tiny-invariant'
import { ChainId, Pair, Percent, Route, Router, Token, TokenAmount, Trade } from '../src'
import JSBI from 'jsbi'
import { describe, expect, test } from 'vitest'

function checkDeadline(deadline: string[] | string): void {
    expect(typeof deadline).toBe('string')
    invariant(typeof deadline === 'string')
    // less than 5 seconds on the deadline
    expect(new Date().getTime() / 1000 - parseInt(deadline)).toBeLessThanOrEqual(5)
}

describe('Router', () => {
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

    const pair_0_1 = new Pair(new TokenAmount(token0, JSBI.BigInt(1000)), new TokenAmount(token1, JSBI.BigInt(1000)))

    describe('#swapCallParameters', () => {
        describe('exact in', () => {
            test('token0 to token1', () => {
                const result = Router.swapCallParameters(
                    Trade.exactIn(new Route([pair_0_1], token0, token1), new TokenAmount(token0, JSBI.BigInt(100))),
                    {
                        ttl: 50,
                        recipient: '0x0000000000000000000000000000000000000004',
                        allowedSlippage: new Percent('1', '100'),
                    }
                )
                expect(result.methodName).toEqual('swapExactTokensForTokens')
                expect(result.args.slice(0, -1)).toEqual([
                    '0x64',
                    '0x59',
                    [token0.address, token1.address],
                    '0x0000000000000000000000000000000000000004',
                ])
                expect(result.value).toEqual('0x0')
                checkDeadline(result.args[result.args.length - 1] as string)
            })
        })
        describe('exact out', () => {
            test('token0 to token1', () => {
                const result = Router.swapCallParameters(
                    Trade.exactOut(new Route([pair_0_1], token0, token1), new TokenAmount(token1, JSBI.BigInt(100))),
                    {
                        ttl: 50,
                        recipient: '0x0000000000000000000000000000000000000004',
                        allowedSlippage: new Percent('1', '100'),
                    }
                )
                expect(result.methodName).toEqual('swapTokensForExactTokens')
                expect(result.args.slice(0, -1)).toEqual([
                    '0x64',
                    '0x71',
                    [token0.address, token1.address],
                    '0x0000000000000000000000000000000000000004',
                ])
                expect(result.value).toEqual('0x0')
                checkDeadline(result.args[result.args.length - 1] as string)
            })
        })
        describe('supporting fee on transfer', () => {
            describe('exact in', () => {
                test('token0 to token1', () => {
                    const result = Router.swapCallParameters(
                        Trade.exactIn(new Route([pair_0_1], token0, token1), new TokenAmount(token0, JSBI.BigInt(100))),
                        {
                            ttl: 50,
                            recipient: '0x0000000000000000000000000000000000000004',
                            allowedSlippage: new Percent('1', '100'),
                            feeOnTransfer: true,
                        }
                    )
                    expect(result.methodName).toEqual('swapExactTokensForTokensSupportingFeeOnTransferTokens')
                    expect(result.args.slice(0, -1)).toEqual([
                        '0x64',
                        '0x59',
                        [token0.address, token1.address],
                        '0x0000000000000000000000000000000000000004',
                    ])
                    expect(result.value).toEqual('0x0')
                    checkDeadline(result.args[result.args.length - 1] as string)
                })
            })
            describe('exact out', () => {
                test('token0 to token1', () => {
                    expect(() =>
                        Router.swapCallParameters(
                            Trade.exactOut(
                                new Route([pair_0_1], token0, token1),
                                new TokenAmount(token1, JSBI.BigInt(100))
                            ),
                            {
                                ttl: 50,
                                recipient: '0x0000000000000000000000000000000000000004',
                                allowedSlippage: new Percent('1', '100'),
                                feeOnTransfer: true,
                            }
                        )
                    ).toThrow('EXACT_OUT_FOT')
                })
            })
        })
    })
})

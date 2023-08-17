import { ChainId, Token } from '../src'
import { describe, expect, test } from 'vitest'

describe('Token', () => {
    const ADDRESS_ONE = '0x0000000000000000000000000000000000000001'
    const ADDRESS_TWO = '0x0000000000000000000000000000000000000002'

    describe('#equals', () => {
        test('fails if address differs', () => {
            expect(
                new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 18 }).equals(
                    new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_TWO, decimals: 18 })
                )
            ).toBe(false)
        })

        test('true if only decimals differs', () => {
            expect(
                new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 9 }).equals(
                    new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 18 })
                )
            ).toBe(true)
        })

        test('true if address is the same', () => {
            expect(
                new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 18 }).equals(
                    new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 18 })
                )
            ).toBe(true)
        })

        test('true on reference equality', () => {
            const token = new Token({ chainId: ChainId.BSC_MAINNET, address: ADDRESS_ONE, decimals: 18 })
            expect(token.equals(token)).toBe(true)
        })

        test('true even if name/symbol/decimals differ', () => {
            const tokenA = new Token({
                chainId: ChainId.BSC_MAINNET,
                address: ADDRESS_ONE,
                decimals: 9,
                symbol: 'abc',
                name: 'def',
            })
            const tokenB = new Token({
                chainId: ChainId.BSC_MAINNET,
                address: ADDRESS_ONE,
                decimals: 18,
                symbol: 'ghi',
                name: 'jkl',
            })
            expect(tokenA.equals(tokenB)).toBe(true)
        })
    })
})

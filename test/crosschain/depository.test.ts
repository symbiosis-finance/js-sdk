import { describe, expect, test } from 'vitest'
import { amountsToPrices, ChainId, Token, TokenAmount } from '../../src'

describe('amountsToPrices', async () => {
    const WAD = BigInt(1e18)

    function t(tokenIn: Token, tokenOut: Token) {
        const decimalsIn = BigInt(10) ** BigInt(tokenIn.decimals)
        const amountIn = new TokenAmount(tokenIn, BigInt(100) * decimalsIn)

        const decimalsOut = BigInt(10) ** BigInt(tokenOut.decimals)

        const tokenAmounts = {
            amountOut: new TokenAmount(tokenOut, BigInt(100) * decimalsOut),
            amountOutMin: new TokenAmount(tokenOut, BigInt(90) * decimalsOut),
        }
        const prices = amountsToPrices(tokenAmounts, amountIn)
        expect(prices.bestPrice).toEqual(BigInt(1) * WAD)
        expect(prices.slippedPrice).toEqual((BigInt(90) * WAD) / BigInt(100))
    }

    test('different decimals', () => {
        const tokenIn = new Token({
            symbol: 'USDT',
            decimals: 6,
            address: '0x0000000000000000000000000000000000000001',
            chainId: ChainId.ARBITRUM_MAINNET,
        })

        const tokenOut = new Token({
            symbol: 'USDC',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000002',
            chainId: ChainId.BSC_MAINNET,
        })
        t(tokenIn, tokenOut)
    })

    test('same decimals', () => {
        const tokenIn = new Token({
            symbol: 'USDT',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000001',
            chainId: ChainId.ARBITRUM_MAINNET,
        })

        const tokenOut = new Token({
            symbol: 'USDC',
            decimals: 18,
            address: '0x0000000000000000000000000000000000000002',
            chainId: ChainId.BSC_MAINNET,
        })

        t(tokenIn, tokenOut)
    })
})

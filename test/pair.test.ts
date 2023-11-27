import { ChainId, Token, Pair, TokenAmount, WETH, Price } from '../src'
import { describe, expect, test } from 'vitest'

describe('Pair', () => {
    const USDC = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin',
    })
    const DAI = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        symbol: 'DAI',
        name: 'DAI Stablecoin',
    })

    describe('constructor', () => {
        test('cannot be used for tokens on different chains', () => {
            expect(
                () => new Pair(new TokenAmount(USDC, '100'), new TokenAmount(WETH[ChainId.BSC_TESTNET], '100'))
            ).toThrow('CHAIN_IDS')
        })
    })

    describe('#getAddress', () => {
        test('returns the correct address', () => {
            expect(Pair.getAddress(USDC, DAI)).toEqual('0xEeC9cA661B7876d4e223C95D6f3b856238dCCDCb')
        })
    })

    describe('#token0', () => {
        test('always is the token that sorts before', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token0).toEqual(DAI)
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token0).toEqual(DAI)
        })
    })
    describe('#token1', () => {
        test('always is the token that sorts after', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token1).toEqual(USDC)
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token1).toEqual(USDC)
        })
    })
    describe('#reserve0', () => {
        test('always comes from the token that sorts before', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve0).toEqual(
                new TokenAmount(DAI, '101')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve0).toEqual(
                new TokenAmount(DAI, '101')
            )
        })
    })
    describe('#reserve1', () => {
        test('always comes from the token that sorts after', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve1).toEqual(
                new TokenAmount(USDC, '100')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve1).toEqual(
                new TokenAmount(USDC, '100')
            )
        })
    })

    describe('#token0Price', () => {
        test('returns price of token0 in terms of token1', () => {
            expect(new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100')).token0Price).toEqual(
                new Price(DAI, USDC, '100', '101')
            )
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '101')).token0Price).toEqual(
                new Price(DAI, USDC, '100', '101')
            )
        })
    })

    describe('#token1Price', () => {
        test('returns price of token1 in terms of token0', () => {
            expect(new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100')).token1Price).toEqual(
                new Price(USDC, DAI, '101', '100')
            )
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '101')).token1Price).toEqual(
                new Price(USDC, DAI, '101', '100')
            )
        })
    })

    describe('#priceOf', () => {
        const pair = new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100'))
        test('returns price of token in terms of other token', () => {
            expect(pair.priceOf(DAI)).toEqual(pair.token0Price)
            expect(pair.priceOf(USDC)).toEqual(pair.token1Price)
        })

        test('throws if invalid token', () => {
            expect(() => pair.priceOf(WETH[ChainId.BSC_MAINNET])).toThrow('TOKEN')
        })
    })

    describe('#reserveOf', () => {
        test('returns reserves of the given token', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserveOf(USDC)).toEqual(
                new TokenAmount(USDC, '100')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(USDC)).toEqual(
                new TokenAmount(USDC, '100')
            )
        })

        test('throws if not in the pair', () => {
            expect(() =>
                new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(WETH[ChainId.BSC_MAINNET])
            ).toThrow('TOKEN')
        })
    })

    describe('#chainId', () => {
        test('returns the token0 chainId', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).chainId).toEqual(
                ChainId.BSC_MAINNET
            )
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).chainId).toEqual(
                ChainId.BSC_MAINNET
            )
        })
    })
    test('#involvesToken', () => {
        expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(USDC)).toEqual(true)
        expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(DAI)).toEqual(true)
        expect(
            new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(WETH[ChainId.BSC_MAINNET])
        ).toEqual(false)
    })
})

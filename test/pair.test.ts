import { ChainId, Token, Pair, TokenAmount, WETH, Price } from '../src'

describe('Pair', () => {
    const USDC = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        decimals: 18,
        symbol: 'USDC',
        name: 'USD Coin'
    })
    const DAI = new Token({
        chainId: ChainId.BSC_MAINNET,
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        decimals: 18,
        symbol: 'DAI',
        name: 'DAI Stablecoin'
    })

    describe('constructor', () => {
        it('cannot be used for tokens on different chains', () => {
            expect(
                () => new Pair(new TokenAmount(USDC, '100'), new TokenAmount(WETH[ChainId.BSC_TESTNET], '100'))
            ).toThrow('CHAIN_IDS')
        })
    })

    describe('#getAddress', () => {
        it('returns the correct address', () => {
            expect(Pair.getAddress(USDC, DAI)).toEqual('0xcA069B7AC1B9759D5f0547aa550c9c51d71D36d1')
        })
    })

    describe('#token0', () => {
        it('always is the token that sorts before', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token0).toEqual(DAI)
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token0).toEqual(DAI)
        })
    })
    describe('#token1', () => {
        it('always is the token that sorts after', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).token1).toEqual(USDC)
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).token1).toEqual(USDC)
        })
    })
    describe('#reserve0', () => {
        it('always comes from the token that sorts before', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve0).toEqual(
                new TokenAmount(DAI, '101')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve0).toEqual(
                new TokenAmount(DAI, '101')
            )
        })
    })
    describe('#reserve1', () => {
        it('always comes from the token that sorts after', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserve1).toEqual(
                new TokenAmount(USDC, '100')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserve1).toEqual(
                new TokenAmount(USDC, '100')
            )
        })
    })

    describe('#token0Price', () => {
        it('returns price of token0 in terms of token1', () => {
            expect(new Pair(new TokenAmount(USDC, '101'), new TokenAmount(DAI, '100')).token0Price).toEqual(
                new Price(DAI, USDC, '100', '101')
            )
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '101')).token0Price).toEqual(
                new Price(DAI, USDC, '100', '101')
            )
        })
    })

    describe('#token1Price', () => {
        it('returns price of token1 in terms of token0', () => {
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
        it('returns price of token in terms of other token', () => {
            expect(pair.priceOf(DAI)).toEqual(pair.token0Price)
            expect(pair.priceOf(USDC)).toEqual(pair.token1Price)
        })

        it('throws if invalid token', () => {
            expect(() => pair.priceOf(WETH[ChainId.BSC_MAINNET])).toThrow('TOKEN')
        })
    })

    describe('#reserveOf', () => {
        it('returns reserves of the given token', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '101')).reserveOf(USDC)).toEqual(
                new TokenAmount(USDC, '100')
            )
            expect(new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(USDC)).toEqual(
                new TokenAmount(USDC, '100')
            )
        })

        it('throws if not in the pair', () => {
            expect(() =>
                new Pair(new TokenAmount(DAI, '101'), new TokenAmount(USDC, '100')).reserveOf(WETH[ChainId.BSC_MAINNET])
            ).toThrow('TOKEN')
        })
    })

    describe('#chainId', () => {
        it('returns the token0 chainId', () => {
            expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).chainId).toEqual(
                ChainId.BSC_MAINNET
            )
            expect(new Pair(new TokenAmount(DAI, '100'), new TokenAmount(USDC, '100')).chainId).toEqual(
                ChainId.BSC_MAINNET
            )
        })
    })
    describe('#involvesToken', () => {
        expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(USDC)).toEqual(true)
        expect(new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(DAI)).toEqual(true)
        expect(
            new Pair(new TokenAmount(USDC, '100'), new TokenAmount(DAI, '100')).involvesToken(WETH[ChainId.BSC_MAINNET])
        ).toEqual(false)
    })
})

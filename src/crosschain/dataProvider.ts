import { ChainId } from '../constants'
import { Token } from '../entities'
import { OneInchOracle } from './contracts'
import { Symbiosis } from './symbiosis'
import { OneInchTrade, UniLikeTrade, getRateToEth } from './trade'
import { getTokenPriceUsd } from './coingecko'

export class DataProvider {
    private cache = new Map<string, any>()

    constructor(private readonly symbiosis: Symbiosis) {}

    async getPairs(tokenIn: Token, tokenOut: Token) {
        return this.fromCache(['getPairs', tokenIn.address, tokenIn.address], () => {
            const provider = this.symbiosis.getProvider(tokenIn.chainId)

            return UniLikeTrade.getPairs(provider, tokenIn, tokenOut)
        })
    }

    async getOneInchProtocols(chainId: ChainId) {
        return this.fromCache(['getOneInchProtocols', chainId], () => {
            return OneInchTrade.getProtocols(this.symbiosis, chainId)
        })
    }

    async getOneInchRateToEth(tokens: Token[], oracle: OneInchOracle) {
        return this.fromCache(['getOneInchRateToEth', ...tokens.map((i) => i.address)], () => {
            return getRateToEth(tokens, oracle)
        })
    }

    async getTokenPrice(token: Token) {
        return this.fromCache(['getTokenPriceUsd', token.address], () => {
            return getTokenPriceUsd(token)
        })
    }

    private async fromCache<T>(key: (number | string)[], func: () => Promise<T>): Promise<T> {
        const stringKey = key.join('-')

        let value = this.cache.get(stringKey)
        if (value) {
            return value
        }

        value = await func()

        this.cache.set(stringKey, value)

        return value
    }
}

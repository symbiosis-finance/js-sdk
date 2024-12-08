import { ChainId } from '../constants'
import { Token } from '../entities'
import { OneInchOracle } from './contracts'
import { Symbiosis } from './symbiosis'
import { getRateToEth, OneInchTrade } from './trade'
import { getTokenPriceUsd } from './coingecko'

export class DataProvider {
    private cache = new Map<string, any>()

    constructor(private readonly symbiosis: Symbiosis) {}

    async getOneInchProtocols(chainId: ChainId) {
        return this.fromCache(['getOneInchProtocols', chainId], () => {
            return OneInchTrade.getProtocols(this.symbiosis, chainId)
        })
    }

    async getOneInchRateToEth(tokens: Token[], oracle: OneInchOracle) {
        return this.fromCache(
            ['getOneInchRateToEth', ...tokens.map((i) => i.address)],
            () => {
                return getRateToEth(tokens, oracle)
            },
            60 // 1 minute
        )
    }

    async getTokenPrice(token: Token) {
        return this.fromCache(
            ['getTokenPriceUsd', token.chainId, token.address],
            () => {
                return getTokenPriceUsd(token)
            },
            600 // 10 minutes
        )
    }

    async get<T>(key: string[], func: () => Promise<T>, ttl?: number): Promise<T> {
        return this.fromCache(
            key,
            () => {
                return func()
            },
            ttl
        )
    }

    private async fromCache<T>(key: (number | string)[], func: () => Promise<T>, ttl?: number): Promise<T> {
        const stringKey = key.join('-')
        const now = Math.floor(Date.now() / 1000)
        const cached = this.cache.get(stringKey)
        if (cached) {
            const { value, expiresAt } = cached
            if (expiresAt === null || now < expiresAt) {
                return value
            }
        }

        const newValue = await func()

        this.cache.set(stringKey, {
            value: newValue,
            expiresAt: ttl ? now + ttl : null,
        })

        return newValue
    }
}

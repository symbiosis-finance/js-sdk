import { Token } from '../entities'
import { getTokenPriceUsd } from './coingecko'

export class DataProvider {
    private cache = new Map<string, any>()

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

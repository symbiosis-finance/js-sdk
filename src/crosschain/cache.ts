export class Cache {
    private data = new Map<string, any>()

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
        const cached = this.data.get(stringKey)
        if (cached) {
            const { value, expiresAt } = cached
            if (expiresAt === null || now < expiresAt) {
                return value
            }
        }

        const newValue = await func()

        this.data.set(stringKey, {
            value: newValue,
            expiresAt: ttl ? now + ttl : null,
        })

        return newValue
    }
}

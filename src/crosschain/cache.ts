import { Span } from '@opentelemetry/api'
import { withSpan } from './tracing'

type CacheItem = {
    result?: unknown
    exception?: unknown
    expiresAt: number
}

type NotVoid<T> = void extends T ? never : T

export class Cache {
    private data = new Map<string, CacheItem>()

    constructor(public maxSize?: number) {}

    async get<T>(
        key: string[],
        func: () => Promise<NotVoid<T>>,
        ttl: number = Number.MAX_SAFE_INTEGER,
        cacheExceptions: boolean = false
    ): Promise<T> {
        const stringKey = key.join('-')
        return await withSpan('Cache.get', { cacheKey: stringKey }, async (span: Span) => {
            const now = Math.floor(Date.now() / 1000)
            const cached = this.data.get(stringKey)
            if (cached) span.setAttribute("expiresAt", cached.expiresAt)
            if (cached && now < cached.expiresAt) {
                if (cached.exception) throw cached.exception
                else return cached.result as T
            }
            span.setAttribute("miss", true)
            const set = (result?: T, exception?: unknown) => {
                if (this.maxSize === undefined || this.data.size < this.maxSize)
                    this.data.set(stringKey, {
                        result: result,
                        exception: exception,
                        expiresAt: now + ttl,
                    })
            }

            try {
                const result = await func()
                set(result)
                return result
            } catch (exc) {
                if (cacheExceptions) set(undefined, exc)
                throw exc
            }
        })
    }
}

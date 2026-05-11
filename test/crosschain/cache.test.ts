import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Cache } from '../../src/crosschain/cache'

vi.mock('../../src/crosschain/tracing', () => ({
    withSpan: (_name: string, _attrs: unknown, fn: (span: unknown) => unknown) => fn({ setAttribute: () => {} }),
}))

describe('Cache', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    test('returns cached value on hit', async () => {
        const cache = new Cache()
        let calls = 0
        const fn = () => {
            calls++
            return Promise.resolve('result')
        }

        const first = await cache.get(['key'], fn, 60)
        const second = await cache.get(['key'], fn, 60)

        expect(first).toBe('result')
        expect(second).toBe('result')
        expect(calls).toBe(1)
    })

    test('re-fetches after ttl expires', async () => {
        const cache = new Cache()
        let calls = 0
        const fn = () => {
            calls++
            return Promise.resolve(`result-${calls}`)
        }

        const first = await cache.get(['key'], fn, 10)
        vi.advanceTimersByTime(11_000)
        const second = await cache.get(['key'], fn, 10)

        expect(first).toBe('result-1')
        expect(second).toBe('result-2')
        expect(calls).toBe(2)
    })

    test('caches exceptions when cacheExceptions is true', async () => {
        const cache = new Cache()
        const error = new Error('fail')
        let calls = 0
        const fn = () => {
            calls++
            return Promise.reject(error)
        }

        await expect(cache.get(['key'], fn, 60, true)).rejects.toThrow('fail')
        await expect(cache.get(['key'], fn, 60, true)).rejects.toThrow('fail')
        expect(calls).toBe(1)
    })

    test('does not cache exceptions by default', async () => {
        const cache = new Cache()
        let calls = 0
        const fn = () => {
            calls++
            return Promise.reject(new Error('fail'))
        }

        await expect(cache.get(['key'], fn, 60)).rejects.toThrow('fail')
        await expect(cache.get(['key'], fn, 60)).rejects.toThrow('fail')
        expect(calls).toBe(2)
    })

    test('uses compound key', async () => {
        const cache = new Cache()

        await cache.get(['a', 'b'], () => Promise.resolve('ab'), 60)
        await cache.get(['a', 'c'], () => Promise.resolve('ac'), 60)

        expect(await cache.get(['a', 'b'], () => Promise.resolve('x'), 60)).toBe('ab')
        expect(await cache.get(['a', 'c'], () => Promise.resolve('x'), 60)).toBe('ac')
    })

    describe('size', () => {
        test('reports current entry count', async () => {
            const cache = new Cache()
            expect(cache.size).toBe(0)

            await cache.get(['a'], () => Promise.resolve(1), 60)
            expect(cache.size).toBe(1)

            await cache.get(['b'], () => Promise.resolve(2), 60)
            expect(cache.size).toBe(2)
        })
    })

    describe('maxSize', () => {
        test('stops adding entries when at capacity', async () => {
            const cache = new Cache(2)

            await cache.get(['a'], () => Promise.resolve(1), 60)
            await cache.get(['b'], () => Promise.resolve(2), 60)
            await cache.get(['c'], () => Promise.resolve(3), 60)

            expect(cache.size).toBe(2)
        })

        test('prunes expired entries to make room for new ones', async () => {
            const cache = new Cache(2)

            await cache.get(['a'], () => Promise.resolve(1), 5)
            await cache.get(['b'], () => Promise.resolve(2), 60)
            expect(cache.size).toBe(2)

            vi.advanceTimersByTime(6_000)

            await cache.get(['c'], () => Promise.resolve(3), 60)
            expect(cache.size).toBe(2)
            expect(await cache.get(['c'], () => Promise.resolve('x'), 60)).toBe(3)
            expect(await cache.get(['b'], () => Promise.resolve('x'), 60)).toBe(2)
        })

        test('no limit when maxSize is undefined', async () => {
            const cache = new Cache()

            for (let i = 0; i < 100; i++) {
                await cache.get([`key-${i}`], () => Promise.resolve(i), 60)
            }

            expect(cache.size).toBe(100)
        })
    })

    describe('auto prune', () => {
        test('prunes expired entries on interval', async () => {
            const cache = new Cache(undefined, 10)

            await cache.get(['short'], () => Promise.resolve(1), 5)
            await cache.get(['long'], () => Promise.resolve(2), 60)
            expect(cache.size).toBe(2)

            vi.advanceTimersByTime(11_000)

            expect(cache.size).toBe(1)
        })

        test('does not start timer when interval is not provided', async () => {
            const cache = new Cache()

            await cache.get(['short'], () => Promise.resolve(1), 5)
            vi.advanceTimersByTime(60_000)

            // expired entry still present since no auto-prune
            expect(cache.size).toBe(1)
        })

    })

    describe('prune', () => {
        test('removes expired entries and returns count', async () => {
            const cache = new Cache()

            await cache.get(['short'], () => Promise.resolve(1), 5)
            await cache.get(['long'], () => Promise.resolve(2), 60)
            expect(cache.size).toBe(2)

            vi.advanceTimersByTime(6_000)

            const pruned = cache.prune()
            expect(pruned).toBe(1)
            expect(cache.size).toBe(1)
        })

        test('returns 0 when nothing to prune', async () => {
            const cache = new Cache()

            await cache.get(['a'], () => Promise.resolve(1), 60)
            expect(cache.prune()).toBe(0)
        })

        test('returns 0 on empty cache', () => {
            const cache = new Cache()
            expect(cache.prune()).toBe(0)
        })
    })
})

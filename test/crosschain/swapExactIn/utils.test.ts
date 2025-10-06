import { describe, expect, test } from 'vitest'
import { theBest } from '../../../src/crosschain/swapExactIn/utils'

describe('#theBest', () => {
    describe('fastest', () => {
        const mode = 'fastest'
        test('empty promises', async () => {
            await expect(theBest([], mode)).rejects.toThrowError('All promises were rejected')
        })
        test('not empty promises', async () => {
            const resolvedPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('success')
                }, 10)
            })
            const rejectedPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject('fail')
                }, 10)
                setTimeout(() => {
                    resolve('success')
                }, 1000)
            })
            const promises: Promise<any>[] = [resolvedPromise, rejectedPromise]
            await expect(theBest(promises, mode)).resolves.not.toThrowError()
        })
        test('not empty promises', async () => {
            const first = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('first')
                }, 10)
            })
            const second = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('second')
                }, 100)
            })
            const promises: Promise<any>[] = [first, second]
            await expect(theBest(promises, mode)).resolves.toBe('first')
        })
    })
    describe('best_return', () => {
        const mode = 'best_return'
        test('empty promises', async () => {
            await expect(theBest([], mode)).rejects.toThrowError('Build route error')
        })
        test('all resolved promises', async () => {
            const rejectedPromise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject('fail')
                }, 10)
                setTimeout(() => {
                    resolve('success')
                }, 1000)
            })
            const promises: Promise<any>[] = [rejectedPromise, rejectedPromise]
            await expect(theBest(promises, mode)).rejects.toThrowError('Build route error')
        })
    })
})

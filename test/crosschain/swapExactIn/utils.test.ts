import { describe, expect, test } from 'vitest'
import { theBest } from '../../../src/crosschain/swapExactIn/utils'

describe('#theBest', () => {
    test('empty promises', async () => {
        await expect(theBest([])).rejects.toThrowError('NoRouteError')
    })
    test('all rejected promises', async () => {
        const rejectedPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
                reject('fail')
            }, 10)
            setTimeout(() => {
                resolve('success')
            }, 1000)
        })
        const promises: Promise<any>[] = [rejectedPromise, rejectedPromise]
        await expect(theBest(promises)).rejects.toThrowError('all routes failed')
    })
})

import { describe, expect, test } from 'vitest'
import { getMinAmount, splitSlippage } from '../../src'

describe('#getMinAmount', () => {
    test('100 3%', () => {
        const minAmount = getMinAmount(300, '100')
        expect(minAmount.toString()).toBe('97')
    })
    test('1000 3%', () => {
        const minAmount = getMinAmount(300, '1000')
        expect(minAmount.toString()).toBe('970')
    })
    test('10000 10%', () => {
        const minAmount = getMinAmount(1000, '10000')
        expect(minAmount.toString()).toBe('9000')
    })
    test('10000000 5%', () => {
        const minAmount = getMinAmount(500, '10000000')
        expect(minAmount.toString()).toBe('9500000')
    })
    test('1000000000 1%', () => {
        const minAmount = getMinAmount(100, '1000000000')
        expect(minAmount.toString()).toBe('990000000')
    })
    test('1000076215 1%', () => {
        const minAmount = getMinAmount(100, '1000076215')
        expect(minAmount.toString()).toBe('990075452')
    })
})

describe('#splitSlippage', () => {
    test('3% false false', () => {
        const detailedSlippage = splitSlippage(300, false, false)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 50,
            C: 0,
        })
    })

    test('3% true false', () => {
        const detailedSlippage = splitSlippage(300, true, false)
        expect(detailedSlippage).toStrictEqual({
            A: 250,
            B: 50,
            C: 0,
        })
    })

    test('3% true true', () => {
        const detailedSlippage = splitSlippage(300, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 100,
            B: 50,
            C: 150,
        })
    })

    test('2% true true', () => {
        const detailedSlippage = splitSlippage(200, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 59.2,
            B: 50,
            C: 88.8,
        })
    })

    test('1% true true', () => {
        const detailedSlippage = splitSlippage(100, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 26.400000000000002,
            B: 33,
            C: 39.6,
        })
    })

    test('0.2% true true', () => {
        const detailedSlippage = splitSlippage(20, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 4.800000000000001,
            B: 6,
            C: 7.199999999999999,
        })
    })
})

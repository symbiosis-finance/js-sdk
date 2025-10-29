import { describe, expect, test } from 'vitest'
import { calculateGasMargin, getMinAmount, splitSlippage } from '../../src/index.ts'
import { BigNumber } from 'ethers'

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

describe('#calculateGasMargin', () => {
    test('100k -> 150k', () => {
        const originalGasLimit = BigNumber.from(100000) // 100k
        const increasedGasLimit = calculateGasMargin(originalGasLimit)
        expect(increasedGasLimit.toString()).toBe('150000')
    })
    test('150k -> 225k', () => {
        const originalGasLimit = BigNumber.from(150000) // 150k
        const increasedGasLimit = calculateGasMargin(originalGasLimit)
        expect(increasedGasLimit.toString()).toBe('225000')
    })
    test('1m -> 1.5m', () => {
        const originalGasLimit = BigNumber.from(1000000) // 1m
        const increasedGasLimit = calculateGasMargin(originalGasLimit)
        expect(increasedGasLimit.toString()).toBe('1500000')
    })
})

describe('#splitSlippage', () => {
    test('3% false false', () => {
        const detailedSlippage = splitSlippage(300, false, false)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 20,
            C: 0,
        })
    })

    test('3% true false', () => {
        const detailedSlippage = splitSlippage(300, true, false)
        expect(detailedSlippage).toStrictEqual({
            A: 280,
            B: 20,
            C: 0,
        })
    })

    test('3% false true', () => {
        const detailedSlippage = splitSlippage(300, false, true)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 20,
            C: 300,
        })
    })

    test('3% true true', () => {
        const detailedSlippage = splitSlippage(300, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 140,
            B: 20,
            C: 160,
        })
    })

    // 1.5%
    test('1.5% true false', () => {
        const detailedSlippage = splitSlippage(150, true, false)
        expect(detailedSlippage).toStrictEqual({
            A: 130,
            B: 20,
            C: 0,
        })
    })
    test('1.5% false true', () => {
        const detailedSlippage = splitSlippage(150, false, true)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 20,
            C: 150,
        })
    })
    test('1.5% true true', () => {
        const detailedSlippage = splitSlippage(150, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 65,
            B: 20,
            C: 85,
        })
    })

    // 1%
    test('1% true true', () => {
        const detailedSlippage = splitSlippage(100, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 40,
            B: 20,
            C: 60,
        })
    })

    // 0.5%
    test('0.5% true false', () => {
        const detailedSlippage = splitSlippage(50, true, false)
        expect(detailedSlippage).toStrictEqual({
            A: 30,
            B: 20,
            C: 0,
        })
    })
    test('0.5% false true', () => {
        const detailedSlippage = splitSlippage(50, false, true)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 20,
            C: 50,
        })
    })
    test('0.5% true true', () => {
        const detailedSlippage = splitSlippage(50, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 16.66,
            B: 16.66,
            C: 33.33,
        })
    })

    test('0.2% true true', () => {
        const detailedSlippage = splitSlippage(20, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 6.66,
            B: 6.66,
            C: 13.33,
        })
    })
    test('0.2% true false', () => {
        const detailedSlippage = splitSlippage(20, true, false)
        expect(detailedSlippage).toStrictEqual({
            A: 10,
            B: 10,
            C: 0,
        })
    })
    test('0.2% false true', () => {
        const detailedSlippage = splitSlippage(20, false, true)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 10,
            C: 20,
        })
    })
    test('0.2% false false', () => {
        expect(splitSlippage(20, false, false)).toStrictEqual({
            A: 0,
            B: 20,
            C: 0,
        })
    })
    test('0.1% false false', () => {
        expect(() => splitSlippage(10, false, false)).toThrowError('Slippage cannot be less than 0.2%')
    })
})

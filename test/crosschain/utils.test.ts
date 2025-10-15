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

    test('3% false true', () => {
        const detailedSlippage = splitSlippage(300, false, true)
        expect(detailedSlippage).toStrictEqual({
            A: 0,
            B: 50,
            C: 300,
        })
    })

    test('3% true true', () => {
        const detailedSlippage = splitSlippage(300, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 125,
            B: 50,
            C: 300,
        })
    })

    test('2% true true', () => {
        const detailedSlippage = splitSlippage(200, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 74.8,
            B: 50,
            C: 200,
        })
    })

    test('1% true true', () => {
        const detailedSlippage = splitSlippage(100, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 33.3,
            B: 33.3,
            C: 100,
        })
    })

    test('0.2% true true', () => {
        const detailedSlippage = splitSlippage(20, true, true)
        expect(detailedSlippage).toStrictEqual({
            A: 6.6,
            B: 6.6,
            C: 20,
        })
    })
})

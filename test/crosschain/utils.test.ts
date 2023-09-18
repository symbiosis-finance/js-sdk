import { describe, expect, test } from 'vitest'
import { getMinAmount } from '../../src'

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

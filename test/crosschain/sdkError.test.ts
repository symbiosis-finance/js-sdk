import { describe, expect, test } from 'vitest'
import { AdvisorError, ChainFlipError, SdkError } from '../../src'

describe('SdkError', async () => {
    test('SdkError', () => {
        const error = new SdkError('Text')
        expect(error.message).toEqual('[SdkError] Text')
    })
    test('AdvisorError', () => {
        const error = new AdvisorError('Advisor Text')
        expect(error.message).toEqual('[AdvisorError] Advisor Text')
    })
    test('ChainFlipError', () => {
        const error = new ChainFlipError('ChainFlipError Text')
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text')
    })
    test('Empty errors list', () => {
        const error = new SdkError('Message')
        expect(error.message).toEqual('[SdkError] Message')
    })
    test('SdkErrors', () => {
        const errors = [new SdkError('CauseMessage')]
        const error = new ChainFlipError('Message', errors)
        expect(error.message).toEqual('[ChainFlipError] Message: [[SdkError] CauseMessage []]')
    })
    test('Errors', () => {
        const errors = [new Error('AggError message 1'), new Error('AggError message 2')]
        const error = new ChainFlipError('ChainFlipError Text', errors)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text: [AggError message 1, AggError message 2]')
    })
    test('AggregateError Cause Empty Errors List', () => {
        const error = new ChainFlipError('ChainFlipError Text', [])
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text')
    })
    test('Wrapped AggregateError Cause', () => {
        const innerAggErrors = [new Error('InnerAggError message 1')]
        const innerAggCause = new AggregateError(innerAggErrors, 'InnerAggCause message')

        const aggErrors = [new Error('AggError message 1'), new Error('AggError message 2'), innerAggCause]

        const error = new ChainFlipError('ChainFlipError Text', aggErrors)
        expect(error.message).toEqual(
            '[ChainFlipError] ChainFlipError Text: [AggError message 1, AggError message 2, InnerAggCause message [InnerAggError message 1]]'
        )
    })
    test('Number Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', [1])
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text: [1]')
    })
    test('Object Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', [{ prop: 'value' }])
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text: [{"prop":"value"}]')
    })
    test('Boolean Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', [true])
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text: [true]')
    })
})

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

    test('String Cause', () => {
        const cause = 'Cause message'
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. String Cause: Cause message')
    })
    test('Error Cause', () => {
        const cause = new Error('Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Error Cause: Cause message')
    })
    test('SdkError Cause', () => {
        const cause = new SdkError('Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Error Cause: [SdkError] Cause message')
    })
    test('AggregateError Cause', () => {
        const errors = [new Error('AggError message 1'), new Error('AggError message 2')]
        const cause = new AggregateError(errors, 'Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual(
            '[ChainFlipError] ChainFlipError Text. AggregateError Cause: Cause message [AggError message 1, AggError message 2]'
        )
    })
    test('AggregateError Cause Empty Errors List', () => {
        const cause = new AggregateError([], 'Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. AggregateError Cause: Cause message []')
    })
})

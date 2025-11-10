import { describe, expect, test } from 'vitest'
import { AdvisorError, AggregateSdkError, ChainFlipError, SdkError } from '../../src'

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
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: Cause message')
    })
    test('Error Cause', () => {
        const cause = new Error('Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: Cause message')
    })
    test('SdkError Cause', () => {
        const cause = new SdkError('Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: [SdkError] Cause message')
    })
    test('AggregateError Cause', () => {
        const errors = [new Error('AggError message 1'), new Error('AggError message 2')]
        const cause = new AggregateError(errors, 'AggCause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual(
            '[ChainFlipError] ChainFlipError Text. Cause: AggCause message [AggError message 1, AggError message 2]'
        )
    })
    test('AggregateError Cause Empty Errors List', () => {
        const cause = new AggregateError([], 'Cause message')
        const error = new ChainFlipError('ChainFlipError Text', cause)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: Cause message []')
    })
    test('Wrapped AggregateError Cause', () => {
        const innerAggErrors = [new Error('InnerAggError message 1')]
        const innerAggCause = new AggregateError(innerAggErrors, 'InnerAggCause message')

        const aggErrors = [new Error('AggError message 1'), new Error('AggError message 2'), innerAggCause]
        const aggCause = new AggregateError(aggErrors, 'Agg Cause message')

        const error = new ChainFlipError('ChainFlipError Text', aggCause)
        expect(error.message).toEqual(
            '[ChainFlipError] ChainFlipError Text. Cause: Agg Cause message [AggError message 1, AggError message 2, InnerAggCause message [InnerAggError message 1]]'
        )
    })
    test('Number Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', 1)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: 1')
    })
    test('Object Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', { prop: 'value' })
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: {"prop":"value"}')
    })
    test('Boolean Cause', () => {
        const error = new ChainFlipError('ChainFlipError Text', true)
        expect(error.message).toEqual('[ChainFlipError] ChainFlipError Text. Cause: true')
    })
})

describe('AggregateSdkError', async () => {
    test('Errors empty', () => {
        const error = new AggregateSdkError([], 'Text')
        expect(error.message).toEqual('Text []')
    })
    test('Several Errors', () => {
        const errors = [new Error('Error 1'), new Error('Error 2')]
        const error = new AggregateSdkError(errors, 'Text')
        expect(error.message).toEqual('Text [Error 1, Error 2]')
    })
    test('Several SdkErrors', () => {
        const errors = [new SdkError('Error 1'), new SdkError('Error 2')]
        const error = new AggregateSdkError(errors, 'Text')
        expect(error.message).toEqual('Text [[SdkError] Error 1, [SdkError] Error 2]')
    })
    test('Several SdkErrors', () => {
        const errors = [new SdkError('Error 1'), new AggregateSdkError([new SdkError('Internal')], 'Error 2')]
        const error = new AggregateSdkError(errors, 'Text')
        expect(error.message).toEqual('Text [[SdkError] Error 1, Error 2 [[SdkError] Internal]]')
    })
})

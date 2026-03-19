import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SwapSDK } from '@chainflip/sdk/swap'

import { waitForChainFlipTxComplete } from '../../../src/crosschain/waitForComplete/waitForChainFlipTxComplete'

const TX_HASH = '4xSMnCo3n9xKfHhFpnVXJpekPWS6c6uCzTz3stnXWBmBFdtmJnCTwGXCBqHxrdW9XnMAqWMQFvHE7LFM6mLNLT8'
const DEST_TX_REF = '2aGCM7vrQdjHXemUdd12kwRjpXpb4wS5jktbP92R6c22xb9sLsnCfnVPxwQ1pjEsunWj7NJe74AFasSTsM4CCh1d'

const POLLING_INTERVAL_MS = 10_000
const TIMEOUT_MS = 20 * 60 * 1000

// Minimal shape required by the type: everything not under test is left out
function makeStatus(overrides: object) {
    return {
        swapId: '123',
        srcAsset: 'SOL',
        srcChain: 'Solana',
        destAsset: 'BTC',
        destChain: 'Bitcoin',
        destAddress: 'bc1q...',
        deposit: { amount: '1000000', witnessedAt: 0, witnessedBlockIndex: '1-1' },
        swap: {
            originalInputAmount: '1000000',
            remainingInputAmount: '0',
            swappedInputAmount: '1000000',
            swappedIntermediateAmount: '0',
            swappedOutputAmount: '1000000',
            regular: {},
        },
        swapEgress: undefined,
        refundEgress: undefined,
        fallbackEgress: undefined,
        ...overrides,
    }
}

describe('MOCK: waitForChainFlipTxComplete', () => {
    // vi.spyOn<SwapSDK, 'getStatusV2'> fails TS2344 because the SDK's method
    // signature is not directly resolvable by TypeScript's constraint checker here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockGetStatusV2: ReturnType<typeof vi.spyOn<any, any>>

    beforeEach(() => {
        vi.useFakeTimers()
        mockGetStatusV2 = vi.spyOn(SwapSDK.prototype, 'getStatusV2')
    })

    afterEach(() => {
        mockGetStatusV2.mockRestore()
        vi.useRealTimers()
    })

    describe('success', () => {
        test('resolves with swapEgress.txRef when state is COMPLETED', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'COMPLETED',
                    swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                })
            )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toBe(DEST_TX_REF)
        })

        test('resolves with swapEgress.txRef when state is FAILED but egress was sent', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'FAILED',
                    swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                })
            )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toBe(DEST_TX_REF)
        })

        test('resolves after polling through intermediate states', async () => {
            mockGetStatusV2
                .mockResolvedValueOnce(makeStatus({ state: 'WAITING' }))
                .mockResolvedValueOnce(makeStatus({ state: 'RECEIVING' }))
                .mockResolvedValueOnce(makeStatus({ state: 'SWAPPING' }))
                .mockResolvedValueOnce(makeStatus({ state: 'SENDING' }))
                .mockResolvedValueOnce(makeStatus({ state: 'SENT' }))
                .mockResolvedValue(
                    makeStatus({
                        state: 'COMPLETED',
                        swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                    })
                )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toBe(DEST_TX_REF)
            expect(mockGetStatusV2).toHaveBeenCalledTimes(6)
        })

        test('passes txHash as id to getStatusV2', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'COMPLETED',
                    swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                })
            )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })
            await vi.runAllTimersAsync()
            await promise

            expect(mockGetStatusV2).toHaveBeenCalledWith({ id: TX_HASH })
        })
    })

    describe('refund / abort', () => {
        test('throws when COMPLETED but swapEgress is absent (refund case)', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'COMPLETED',
                    swapEgress: undefined,
                    refundEgress: { txRef: '0xrefundtx', amount: '12976943178' },
                    swap: {
                        originalInputAmount: '12977447723',
                        remainingInputAmount: '12977447723',
                        swappedInputAmount: '0',
                        swappedIntermediateAmount: '0',
                        swappedOutputAmount: '0',
                        regular: {
                            inputAmount: '12977447723',
                            abortedReason: 'MinPriceViolation',
                        },
                    },
                })
            )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })

            await expect(promise).rejects.toThrow('MinPriceViolation')
            await expect(promise).rejects.toMatchObject({ name: 'WaitForChainFlipTxCompleteError' })
        })

        test('throws when COMPLETED with no swapEgress and no abortedReason (generic refund)', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'COMPLETED',
                    swapEgress: undefined,
                    refundEgress: { txRef: '0xrefundtx', amount: '12976943178' },
                })
            )

            await expect(waitForChainFlipTxComplete({ txHash: TX_HASH })).rejects.toThrow('swap was refunded')
        })

        test('throws when FAILED with no swapEgress (refund egress failure)', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'FAILED',
                    swapEgress: undefined,
                    refundEgress: {
                        txRef: undefined,
                        amount: '0',
                        failure: { reason: { code: 'err', message: 'BelowMinimumDeposit' } },
                    },
                })
            )

            await expect(waitForChainFlipTxComplete({ txHash: TX_HASH })).rejects.toThrow('BelowMinimumDeposit')
        })

        test('falls back to "swap was refunded" when all reason fields are absent', async () => {
            mockGetStatusV2.mockResolvedValue(
                makeStatus({
                    state: 'COMPLETED',
                    swapEgress: undefined,
                    refundEgress: undefined,
                })
            )

            await expect(waitForChainFlipTxComplete({ txHash: TX_HASH })).rejects.toThrow('swap was refunded')
        })
    })

    describe('polling behaviour', () => {
        test('retries after getStatusV2 throws a transient error', async () => {
            mockGetStatusV2
                .mockRejectedValueOnce(new Error('network error'))
                .mockRejectedValueOnce(new Error('503'))
                .mockResolvedValue(
                    makeStatus({
                        state: 'COMPLETED',
                        swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                    })
                )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toBe(DEST_TX_REF)
            expect(mockGetStatusV2).toHaveBeenCalledTimes(3)
        })

        test('polls at the expected interval', async () => {
            // First call resolves immediately (no timer), subsequent calls via setInterval
            mockGetStatusV2
                .mockResolvedValueOnce(makeStatus({ state: 'WAITING' }))
                .mockResolvedValueOnce(makeStatus({ state: 'SWAPPING' }))
                .mockResolvedValue(
                    makeStatus({
                        state: 'COMPLETED',
                        swapEgress: { txRef: DEST_TX_REF, amount: '99000000' },
                    })
                )

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })

            // First call is immediate — flush microtasks only
            await Promise.resolve()
            expect(mockGetStatusV2).toHaveBeenCalledTimes(1)

            // Advance one interval
            await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS)
            expect(mockGetStatusV2).toHaveBeenCalledTimes(2)

            // Advance another interval — resolves
            await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS)
            await expect(promise).resolves.toBe(DEST_TX_REF)
        })

        test('throws timeout error when swap never completes', async () => {
            mockGetStatusV2.mockResolvedValue(makeStatus({ state: 'SWAPPING' }))

            const promise = waitForChainFlipTxComplete({ txHash: TX_HASH })

            // Attach handlers before advancing timers to avoid unhandled rejection
            await Promise.all([
                expect(promise).rejects.toThrow(`ChainFlip swap tracking timed out for tx: ${TX_HASH}`),
                expect(promise).rejects.toMatchObject({ name: 'WaitForChainFlipTxCompleteError' }),
                vi.advanceTimersByTimeAsync(TIMEOUT_MS + POLLING_INTERVAL_MS),
            ])
        })
    })
})

describe('REAL: waitForChainFlipTxComplete', () => {
    test('success Bitcoin', async () => {
        const result = await waitForChainFlipTxComplete({
            txHash: '0xf4b7495273d38a6877d5246cef3e928fea0d63af373424744834b4c095745f09',
        })

        expect(result).toBe('6998d61be596aaf1228c74cc5bfb7c760574c5c083f355e6f385510b541893ae')
    }, 30_000)

    test('success Solana', async () => {
        const result = await waitForChainFlipTxComplete({
            txHash: '0x228dde864e813b34b845ffca36efa341d823bbadb81bef309d8fc4b9c9dcc42b',
        })

        expect(result).toBe('3Tn4hR2MdWoBKePpGkP2hW16i8tUQLsww3x8RuXhd3G33v5uA3roEzLa1VEq39P6W6BoT215C1EwJTDK2kZcvKtw')
    }, 30_000)

    test('refund', async () => {
        const promise = waitForChainFlipTxComplete({
            txHash: '0xa0b2e0885016d38c8765dfc22607dd623fac1be5fdeda38a20080c7a157cdbaa',
        })

        await expect(promise).rejects.toThrowError('ChainFlip swap did not complete: MinPriceViolation')
    }, 30_000)
})

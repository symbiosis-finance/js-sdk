import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BigNumber } from '@ethersproject/bignumber'

import { ChainId } from '../../../src'
import { waitForThorChainTx } from '../../../src/crosschain/waitForComplete/waitForThorChainSwap'

const THORCHAIN_DEPOSIT_TOPIC0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
const TX_HASH = '0xabc123'
const OUT_HASH = 'deadbeef1234567890'
const ZERO_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

const POLLING_INTERVAL_MS = 10_000
const TIMEOUT_MS = 3_600_000

const THORCHAIN_LOG = {
    topics: [THORCHAIN_DEPOSIT_TOPIC0],
    data: '0x',
    address: '0xthorrouter',
    logIndex: 0,
    transactionHash: TX_HASH,
    blockNumber: 100,
    blockHash: '0xblockhash',
    transactionIndex: 0,
    removed: false,
}

const RECEIPT = {
    transactionHash: TX_HASH,
    logs: [THORCHAIN_LOG],
    blockNumber: 100,
    blockHash: '0xblockhash',
    contractAddress: '0x',
    transactionIndex: 0,
    status: 1,
    from: '0xfrom',
    to: '0xto',
    gasUsed: BigNumber.from(21000),
    cumulativeGasUsed: BigNumber.from(21000),
    effectiveGasPrice: BigNumber.from(1),
    logsBloom: '0x',
    byzantium: true,
    confirmations: 1,
    type: 0,
}

const { mockThorchainTx } = vi.hoisted(() => ({
    mockThorchainTx: vi.fn(),
}))

vi.mock('../../../src/crosschain/api/thorchain', () => ({
    thorchainApi: {
        thorchain: {
            tx: mockThorchainTx,
        },
    },
}))

describe('waitForThorChainTx', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    describe('early return', () => {
        test('returns undefined when receipt has no ThorChain deposit log', async () => {
            const receiptWithoutThor = { ...RECEIPT, logs: [] }

            const result = await waitForThorChainTx(receiptWithoutThor as any)

            expect(result).toBeUndefined()
            expect(mockThorchainTx).not.toHaveBeenCalled()
        })

        test('returns undefined when log topics are empty', async () => {
            const receiptWithEmptyTopics = {
                ...RECEIPT,
                logs: [{ ...THORCHAIN_LOG, topics: [] }],
            }

            const result = await waitForThorChainTx(receiptWithEmptyTopics as any)

            expect(result).toBeUndefined()
        })

        test('returns undefined when log topic does not match', async () => {
            const receiptWithWrongTopic = {
                ...RECEIPT,
                logs: [{ ...THORCHAIN_LOG, topics: ['0xwrongtopic'] }],
            }

            const result = await waitForThorChainTx(receiptWithWrongTopic as any)

            expect(result).toBeUndefined()
        })
    })

    describe('success', () => {
        test('resolves with outHash and BTC_MAINNET chainId', async () => {
            mockThorchainTx.mockResolvedValue({
                observed_tx: {
                    status: 'done',
                    out_hashes: [OUT_HASH],
                },
            })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
        })

        test('strips 0x prefix from txHash before calling API', async () => {
            mockThorchainTx.mockResolvedValue({
                observed_tx: {
                    status: 'done',
                    out_hashes: [OUT_HASH],
                },
            })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()
            await promise

            expect(mockThorchainTx).toHaveBeenCalledWith('abc123')
        })

        test('skips zero hash and returns non-zero outHash', async () => {
            mockThorchainTx.mockResolvedValue({
                observed_tx: {
                    status: 'done',
                    out_hashes: [ZERO_HASH, OUT_HASH],
                },
            })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
        })

        test('works with txHash without 0x prefix', async () => {
            const receiptNoPrefix = {
                ...RECEIPT,
                transactionHash: 'abc123',
            }
            mockThorchainTx.mockResolvedValue({
                observed_tx: {
                    status: 'done',
                    out_hashes: [OUT_HASH],
                },
            })

            const promise = waitForThorChainTx(receiptNoPrefix as any)
            await vi.runAllTimersAsync()
            await promise

            expect(mockThorchainTx).toHaveBeenCalledWith('abc123')
        })
    })

    describe('polling behaviour', () => {
        test('polls through incomplete states until done', async () => {
            mockThorchainTx
                .mockResolvedValueOnce({ observed_tx: { status: 'incomplete' } })
                .mockResolvedValueOnce({ observed_tx: { status: 'incomplete' } })
                .mockResolvedValue({
                    observed_tx: {
                        status: 'done',
                        out_hashes: [OUT_HASH],
                    },
                })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
            expect(mockThorchainTx).toHaveBeenCalledTimes(3)
        })

        test('keeps polling when status is done but out_hashes are only zeros', async () => {
            mockThorchainTx
                .mockResolvedValueOnce({
                    observed_tx: {
                        status: 'done',
                        out_hashes: [ZERO_HASH],
                    },
                })
                .mockResolvedValue({
                    observed_tx: {
                        status: 'done',
                        out_hashes: [OUT_HASH],
                    },
                })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
            expect(mockThorchainTx).toHaveBeenCalledTimes(2)
        })

        test('retries after API throws transient error', async () => {
            mockThorchainTx.mockRejectedValueOnce(new Error('network error')).mockResolvedValue({
                observed_tx: {
                    status: 'done',
                    out_hashes: [OUT_HASH],
                },
            })

            const promise = waitForThorChainTx(RECEIPT as any)
            await vi.runAllTimersAsync()

            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
            expect(mockThorchainTx).toHaveBeenCalledTimes(2)
        })

        test('polls at the expected interval', async () => {
            mockThorchainTx
                .mockResolvedValueOnce({ observed_tx: { status: 'incomplete' } })
                .mockResolvedValueOnce({ observed_tx: { status: 'incomplete' } })
                .mockResolvedValue({
                    observed_tx: {
                        status: 'done',
                        out_hashes: [OUT_HASH],
                    },
                })

            const promise = waitForThorChainTx(RECEIPT as any)

            await Promise.resolve()
            expect(mockThorchainTx).toHaveBeenCalledTimes(1)

            await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS)
            expect(mockThorchainTx).toHaveBeenCalledTimes(2)

            await vi.advanceTimersByTimeAsync(POLLING_INTERVAL_MS)
            await expect(promise).resolves.toEqual({
                txHash: OUT_HASH,
                chainId: ChainId.BTC_MAINNET,
            })
        })

        test('throws TxNotFound when polling exceeds timeout', async () => {
            mockThorchainTx.mockResolvedValue({ observed_tx: { status: 'incomplete' } })

            const promise = waitForThorChainTx(RECEIPT as any)

            await Promise.all([
                expect(promise).rejects.toThrow(`Transaction ${TX_HASH} not found`),
                expect(promise).rejects.toMatchObject({ name: 'TxNotFound' }),
                vi.advanceTimersByTimeAsync(TIMEOUT_MS + POLLING_INTERVAL_MS),
            ])
        })
    })
})

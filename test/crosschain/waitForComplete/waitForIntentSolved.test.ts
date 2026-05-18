import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BigNumber } from '@ethersproject/bignumber'

import { ChainId, waitForIntentSolved } from '../../../src'

const INTENT_LOCKED_TOPIC0 = 'mock-intent-locked-topic0'
const DST_CHAIN_ID = ChainId.ARBITRUM_MAINNET
const SRC_CHAIN_ID = ChainId.ETH_MAINNET

const FILLED_TX_HASH = '0xfilledtxhash'
const UNLOCKED_TX_HASH = '0xunlockedtxhash'

const INTENT_LOCKED_LOG = {
    topics: [INTENT_LOCKED_TOPIC0],
    data: '0x',
    address: '0xdepositorySrc',
    logIndex: 0,
    transactionHash: '0xsrctxhash',
    blockNumber: 100,
    blockHash: '0xblockhash',
    transactionIndex: 0,
    removed: false,
}

const RECEIPT = {
    transactionHash: '0xsrctxhash',
    logs: [INTENT_LOCKED_LOG],
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

const INTENT_FILLED_LOG = {
    topics: ['0xfilledtopic'],
    data: '0x',
    address: '0xdepositoryDst',
    logIndex: 0,
    transactionHash: FILLED_TX_HASH,
    blockNumber: 200,
    blockHash: '0xdstblockhash',
    transactionIndex: 0,
    removed: false,
}

const INTENT_UNLOCKED_LOG = {
    topics: ['0xunlockedtopic'],
    data: '0x',
    address: '0xdepositorySrc',
    logIndex: 0,
    transactionHash: UNLOCKED_TX_HASH,
    blockNumber: 300,
    blockHash: '0xsrcblockhash2',
    transactionIndex: 0,
    removed: false,
}

const {
    mockGetLogWithTimeout,
    mockDepositorySrcInterface,
    mockDepositoryDstInterface,
    mockDeadlineUnlockerInterface,
    mockIntentFilledFilter,
    mockIntentUnlockedFilter,
} = vi.hoisted(() => {
    const mockIntentFilledFilter = { topics: ['0xIntentFilled', '0xintentid'] }
    const mockIntentUnlockedFilter = { topics: ['0xIntentUnlocked', '0xintentid'] }

    const mockDepositorySrcInterface = {
        getEventTopic: vi.fn().mockReturnValue('mock-intent-locked-topic0'),
        parseLog: vi.fn().mockReturnValue({
            args: {
                intentId: '0xintentid',
                fillCondition: {
                    unlocker: '0xunlocker',
                    condition: '0xconditiondata',
                },
            },
        }),
    }

    const mockDepositoryDstInterface = {
        parseLog: vi.fn().mockReturnValue({
            args: {
                intentId: '0xintentid',
                solver: '0xsolver',
                solution: '0xsolutiondata',
            },
        }),
    }

    const mockDeadlineUnlockerInterface = {
        getFunction: vi.fn().mockImplementation((name: string) => {
            if (name === 'encodeCondition') {
                return { inputs: ['conditionInputs'] }
            }
            if (name === 'encodeSolution') {
                return { inputs: ['solutionInputs'] }
            }
            return { inputs: [] }
        }),
        _abiCoder: {
            decode: vi.fn(),
        },
    }

    return {
        mockGetLogWithTimeout: vi.fn(),
        mockDepositorySrcInterface,
        mockDepositoryDstInterface,
        mockDeadlineUnlockerInterface,
        mockIntentFilledFilter,
        mockIntentUnlockedFilter,
    }
})

vi.mock('../../../src/crosschain/chainUtils', async (importOriginal) => ({
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    ...(await importOriginal<typeof import('../../../src/crosschain/chainUtils')>()),
    getLogWithTimeout: (...args: unknown[]) => mockGetLogWithTimeout(...args),
}))

vi.mock('../../../src/crosschain/contracts', () => ({
    DepositorySrc__factory: {
        connect: vi.fn().mockReturnValue({
            interface: mockDepositorySrcInterface,
            filters: {
                IntentUnlocked: vi.fn().mockReturnValue(mockIntentUnlockedFilter),
            },
        }),
    },
    DepositoryDst__factory: {
        connect: vi.fn().mockReturnValue({
            interface: mockDepositoryDstInterface,
            filters: {
                IntentFilled: vi.fn().mockReturnValue(mockIntentFilledFilter),
            },
        }),
    },
    DeadlineUnlocker__factory: {
        createInterface: vi.fn().mockReturnValue(mockDeadlineUnlockerInterface),
    },
}))

function makeSymbiosis({
    srcIntentConfig,
    dstIntentConfig,
}: {
    srcIntentConfig?: object
    dstIntentConfig?: object
} = {}) {
    return {
        chainConfig: vi.fn().mockImplementation((chainId: ChainId) => {
            if (chainId === SRC_CHAIN_ID) {
                return { intentConfig: srcIntentConfig }
            }
            if (chainId === DST_CHAIN_ID) {
                return { intentConfig: dstIntentConfig }
            }
            return {}
        }),
        getProvider: vi.fn().mockReturnValue({}),
    } as any
}

describe('waitForIntentSolved', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('early returns', () => {
        test('returns undefined when chain has no intentConfig', async () => {
            const symbiosis = makeSymbiosis()

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(result).toBeUndefined()
            expect(mockGetLogWithTimeout).not.toHaveBeenCalled()
        })

        test('returns undefined when receipt has no IntentLocked log', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
            })
            const receiptWithoutIntent = { ...RECEIPT, logs: [] }

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, receiptWithoutIntent as any)

            expect(result).toBeUndefined()
            expect(mockGetLogWithTimeout).not.toHaveBeenCalled()
        })

        test('returns undefined when receipt logs have empty topics', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
            })
            const receiptWithEmptyTopics = {
                ...RECEIPT,
                logs: [{ ...INTENT_LOCKED_LOG, topics: [] }],
            }

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, receiptWithEmptyTopics as any)

            expect(result).toBeUndefined()
        })

        test('returns undefined when destination chain has no intentConfig', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: {
                    depositorySrc: '0xdepositorySrc',
                    depositoryDst: '0xdepositoryDst',
                },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode.mockReturnValueOnce([
                { dstChainId: BigNumber.from(DST_CHAIN_ID) },
            ])

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(result).toBeUndefined()
            expect(mockGetLogWithTimeout).not.toHaveBeenCalled()
        })
    })

    describe('normal fill (branch 0)', () => {
        test('returns destination txHash and chainId', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
                dstIntentConfig: { depositoryDst: '0xdepositoryDst' },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode
                .mockReturnValueOnce([{ dstChainId: BigNumber.from(DST_CHAIN_ID) }])
                .mockReturnValueOnce([{ branch: BigNumber.from(0) }])
            mockGetLogWithTimeout.mockResolvedValueOnce(INTENT_FILLED_LOG)

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(result).toEqual({
                txHash: FILLED_TX_HASH,
                chainId: DST_CHAIN_ID,
            })
        })

        test('calls getLogWithTimeout with correct params for IntentFilled', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
                dstIntentConfig: { depositoryDst: '0xdepositoryDst' },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode
                .mockReturnValueOnce([{ dstChainId: BigNumber.from(DST_CHAIN_ID) }])
                .mockReturnValueOnce([{ branch: BigNumber.from(0) }])
            mockGetLogWithTimeout.mockResolvedValueOnce(INTENT_FILLED_LOG)

            await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(mockGetLogWithTimeout).toHaveBeenCalledWith({
                symbiosis,
                chainId: DST_CHAIN_ID,
                filter: mockIntentFilledFilter,
                exceedDelay: 1000 * 60 * 60 * 2,
            })
        })
    })

    describe('refund (branch 1)', () => {
        test('returns source chain txHash and chainId', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
                dstIntentConfig: { depositoryDst: '0xdepositoryDst' },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode
                .mockReturnValueOnce([{ dstChainId: BigNumber.from(DST_CHAIN_ID) }])
                .mockReturnValueOnce([{ branch: BigNumber.from(1) }])
            mockGetLogWithTimeout.mockResolvedValueOnce(INTENT_FILLED_LOG).mockResolvedValueOnce(INTENT_UNLOCKED_LOG)

            const result = await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(result).toEqual({
                txHash: UNLOCKED_TX_HASH,
                chainId: SRC_CHAIN_ID,
            })
        })

        test('calls getLogWithTimeout for IntentUnlocked on source chain', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
                dstIntentConfig: { depositoryDst: '0xdepositoryDst' },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode
                .mockReturnValueOnce([{ dstChainId: BigNumber.from(DST_CHAIN_ID) }])
                .mockReturnValueOnce([{ branch: BigNumber.from(1) }])
            mockGetLogWithTimeout.mockResolvedValueOnce(INTENT_FILLED_LOG).mockResolvedValueOnce(INTENT_UNLOCKED_LOG)

            await waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)

            expect(mockGetLogWithTimeout).toHaveBeenCalledTimes(2)
            expect(mockGetLogWithTimeout).toHaveBeenNthCalledWith(2, {
                symbiosis,
                chainId: SRC_CHAIN_ID,
                filter: mockIntentUnlockedFilter,
                exceedDelay: 1000 * 60 * 60 * 2,
            })
        })
    })

    describe('unknown branch', () => {
        test('throws SdkError for unknown solution branch', async () => {
            const symbiosis = makeSymbiosis({
                srcIntentConfig: { depositorySrc: '0xdepositorySrc' },
                dstIntentConfig: { depositoryDst: '0xdepositoryDst' },
            })
            mockDeadlineUnlockerInterface._abiCoder.decode
                .mockReturnValueOnce([{ dstChainId: BigNumber.from(DST_CHAIN_ID) }])
                .mockReturnValueOnce([{ branch: BigNumber.from(99) }])
            mockGetLogWithTimeout.mockResolvedValueOnce(INTENT_FILLED_LOG)

            await expect(waitForIntentSolved(symbiosis, SRC_CHAIN_ID, RECEIPT as any)).rejects.toThrow(
                'Unknown solution branch'
            )
        })
    })
})

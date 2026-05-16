import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { BigNumber } from '@ethersproject/bignumber'

import { ChainId, waitForDepositUnlocked } from '../../../src'

const DEPOSIT_LOCKED_TOPIC0 = 'mock-deposit-locked-topic0'
const DEPOSIT_ID = '0xdepositid123'
const CHAIN_ID = ChainId.ETH_MAINNET
const UNLOCKED_TX_HASH = '0xunlockedtxhash'
const SRC_BLOCK_NUMBER = 100

const DEPOSIT_LOCKED_LOG = {
    topics: [DEPOSIT_LOCKED_TOPIC0],
    data: '0x',
    address: '0xdepository',
    logIndex: 0,
    transactionHash: '0xsrctxhash',
    blockNumber: SRC_BLOCK_NUMBER,
    blockHash: '0xblockhash',
    transactionIndex: 0,
    removed: false,
}

const RECEIPT = {
    transactionHash: '0xsrctxhash',
    logs: [DEPOSIT_LOCKED_LOG],
    blockNumber: SRC_BLOCK_NUMBER,
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

const DEPOSIT_UNLOCKED_LOG = {
    topics: ['0xunlockedtopic'],
    data: '0x',
    address: '0xdepository',
    logIndex: 0,
    transactionHash: UNLOCKED_TX_HASH,
    blockNumber: 200,
    blockHash: '0xunlockedblockhash',
    transactionIndex: 0,
    removed: false,
}

const { mockGetLogWithTimeout } = vi.hoisted(() => ({
    mockGetLogWithTimeout: vi.fn(),
}))

vi.mock('../../../src/crosschain/chainUtils', async (importOriginal) => ({
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    ...(await importOriginal<typeof import('../../../src/crosschain/chainUtils')>()),
    getLogWithTimeout: (...args: unknown[]) => mockGetLogWithTimeout(...args),
}))

const mockDepositUnlockedFilter = { topics: ['0xDepositUnlocked', DEPOSIT_ID] }

const mockDepositoryInterface = {
    getEventTopic: vi.fn().mockReturnValue(DEPOSIT_LOCKED_TOPIC0),
    parseLog: vi.fn().mockReturnValue({
        args: { depositID: DEPOSIT_ID },
    }),
}

const mockDepositoryContract = {
    interface: mockDepositoryInterface,
    filters: {
        DepositUnlocked: vi.fn().mockReturnValue(mockDepositUnlockedFilter),
    },
}

function makeSymbiosis({ hasDepository = true } = {}) {
    return {
        depository: vi.fn().mockResolvedValue(hasDepository ? { depository: mockDepositoryContract } : null),
    } as any
}

describe('waitForDepositUnlocked', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('early returns', () => {
        test('returns undefined when depository is null', async () => {
            const symbiosis = makeSymbiosis({ hasDepository: false })

            const result = await waitForDepositUnlocked(symbiosis, CHAIN_ID, RECEIPT as any)

            expect(result).toBeUndefined()
            expect(mockGetLogWithTimeout).not.toHaveBeenCalled()
        })

        test('returns undefined when receipt has no DepositLocked log', async () => {
            const symbiosis = makeSymbiosis()
            const receiptWithoutDeposit = { ...RECEIPT, logs: [] }

            const result = await waitForDepositUnlocked(symbiosis, CHAIN_ID, receiptWithoutDeposit as any)

            expect(result).toBeUndefined()
            expect(mockGetLogWithTimeout).not.toHaveBeenCalled()
        })

        test('returns undefined when log topics are empty', async () => {
            const symbiosis = makeSymbiosis()
            const receiptWithEmptyTopics = {
                ...RECEIPT,
                logs: [{ ...DEPOSIT_LOCKED_LOG, topics: [] }],
            }

            const result = await waitForDepositUnlocked(symbiosis, CHAIN_ID, receiptWithEmptyTopics as any)

            expect(result).toBeUndefined()
        })
    })

    describe('success', () => {
        test('returns unlocked txHash and chainId', async () => {
            const symbiosis = makeSymbiosis()
            mockGetLogWithTimeout.mockResolvedValueOnce(DEPOSIT_UNLOCKED_LOG)

            const result = await waitForDepositUnlocked(symbiosis, CHAIN_ID, RECEIPT as any)

            expect(result).toEqual({
                txHash: UNLOCKED_TX_HASH,
                chainId: CHAIN_ID,
            })
        })

        test('passes depositID to DepositUnlocked filter', async () => {
            const symbiosis = makeSymbiosis()
            mockGetLogWithTimeout.mockResolvedValueOnce(DEPOSIT_UNLOCKED_LOG)

            await waitForDepositUnlocked(symbiosis, CHAIN_ID, RECEIPT as any)

            expect(mockDepositoryContract.filters.DepositUnlocked).toHaveBeenCalledWith(DEPOSIT_ID)
        })

        test('calls getLogWithTimeout with fromBlock from the deposit log', async () => {
            const symbiosis = makeSymbiosis()
            mockGetLogWithTimeout.mockResolvedValueOnce(DEPOSIT_UNLOCKED_LOG)

            await waitForDepositUnlocked(symbiosis, CHAIN_ID, RECEIPT as any)

            expect(mockGetLogWithTimeout).toHaveBeenCalledWith({
                symbiosis,
                chainId: CHAIN_ID,
                filter: { ...mockDepositUnlockedFilter, fromBlock: SRC_BLOCK_NUMBER },
                exceedDelay: 1000 * 60 * 60 * 2,
            })
        })
    })
})

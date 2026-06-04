import type { Log } from '@ethersproject/providers'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ChainId } from '../../src/constants'
import { GetLogTimeoutExceededError, getLogWithTimeout } from '../../src/crosschain/chainUtils/evm'
import type { Symbiosis } from '../../src/crosschain/symbiosis'

const CHAIN_ID = ChainId.BSC_MAINNET
const FILTER = { address: '0x0000000000000000000000000000000000000001', fromBlock: 1 }
const LOG = { blockNumber: 2, transactionHash: '0xdeadbeef' } as Log

const PERIOD = 10_000 // hardcoded polling period inside getLogWithTimeout
const EXCEED_DELAY = 25_000 // rejects on the tick where pastTime (10s, 20s, 30s...) exceeds this

interface MockProvider {
    getLogs: ReturnType<typeof vi.fn>
}

function makeSymbiosis(primary: MockProvider, spares: MockProvider[]): Symbiosis {
    const spareRpcs = spares.map((_, i) => `https://spare-rpc-${i}.example`)
    return {
        config: {
            chains: [{ id: CHAIN_ID, spareRpcs }],
        },
        getProvider: (_chainId: ChainId, rpc?: string) => {
            if (rpc === undefined) {
                return primary
            }
            return spares[spareRpcs.indexOf(rpc)]
        },
    } as unknown as Symbiosis
}

// node emits 'unhandledRejection' on event loop turns, so give it real ones
// (setImmediate is deliberately kept out of the faked timers list)
async function flushEventLoop() {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setImmediate(resolve))
    }
}

describe('getLogWithTimeout', () => {
    let unhandledRejections: unknown[]
    const onUnhandledRejection = (reason: unknown) => {
        unhandledRejections.push(reason)
    }

    beforeEach(() => {
        unhandledRejections = []
        process.on('unhandledRejection', onUnhandledRejection)
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    })

    afterEach(async () => {
        vi.useRealTimers()
        await flushEventLoop()
        process.off('unhandledRejection', onUnhandledRejection)
    })

    test('all providers failing does not produce an unhandled rejection and times out', async () => {
        const primary = { getLogs: vi.fn().mockRejectedValue(new Error('primary rpc down')) }
        const spares = [
            { getLogs: vi.fn().mockRejectedValue(new Error('spare rpc 0 down')) },
            { getLogs: vi.fn().mockRejectedValue(new Error('spare rpc 1 down')) },
        ]
        const symbiosis = makeSymbiosis(primary, spares)

        const promise = getLogWithTimeout({ symbiosis, chainId: CHAIN_ID, filter: FILTER, exceedDelay: EXCEED_DELAY })
        const assertion = expect(promise).rejects.toBeInstanceOf(GetLogTimeoutExceededError)

        await vi.advanceTimersByTimeAsync(EXCEED_DELAY + PERIOD)
        await assertion

        // polling continued after the first failed tick: immediate call + tick at 10s
        // (the tick at 20s rejects with the timeout before querying providers)
        expect(primary.getLogs).toHaveBeenCalledTimes(2)
        expect(spares[0].getLogs).toHaveBeenCalledTimes(2)
        expect(spares[1].getLogs).toHaveBeenCalledTimes(2)

        await flushEventLoop()
        expect(unhandledRejections).toEqual([])
    })

    test('empty spareRpcs with failing primary skips the tick instead of hanging', async () => {
        const primary = { getLogs: vi.fn().mockRejectedValue(new Error('primary rpc down')) }
        const symbiosis = makeSymbiosis(primary, [])

        const promise = getLogWithTimeout({ symbiosis, chainId: CHAIN_ID, filter: FILTER, exceedDelay: EXCEED_DELAY })
        const assertion = expect(promise).rejects.toBeInstanceOf(GetLogTimeoutExceededError)

        await vi.advanceTimersByTimeAsync(EXCEED_DELAY + PERIOD)
        await assertion

        // every tick completed and the next one ran: no tick hung on an empty promise race
        expect(primary.getLogs).toHaveBeenCalledTimes(2)

        await flushEventLoop()
        expect(unhandledRejections).toEqual([])
    })

    test('recovers when the provider fails on the first tick and succeeds on the second', async () => {
        const primary = {
            getLogs: vi.fn().mockRejectedValueOnce(new Error('temporary rpc error')).mockResolvedValue([LOG]),
        }
        const symbiosis = makeSymbiosis(primary, [])

        const promise = getLogWithTimeout({ symbiosis, chainId: CHAIN_ID, filter: FILTER })

        await vi.advanceTimersByTimeAsync(PERIOD)
        await expect(promise).resolves.toEqual(LOG)
        expect(primary.getLogs).toHaveBeenCalledTimes(2)

        // interval is cleared after resolving
        await vi.advanceTimersByTimeAsync(PERIOD * 3)
        expect(primary.getLogs).toHaveBeenCalledTimes(2)

        await flushEventLoop()
        expect(unhandledRejections).toEqual([])
    })

    test('resolves with the first matching log on the first tick', async () => {
        const primary = { getLogs: vi.fn().mockResolvedValue([LOG, { ...LOG, blockNumber: 3 }]) }
        const spare = { getLogs: vi.fn() }
        const symbiosis = makeSymbiosis(primary, [spare])

        const promise = getLogWithTimeout({ symbiosis, chainId: CHAIN_ID, filter: FILTER })

        await expect(promise).resolves.toEqual(LOG)
        expect(primary.getLogs).toHaveBeenCalledTimes(1)
        expect(spare.getLogs).not.toHaveBeenCalled()

        // interval is cleared after resolving
        await vi.advanceTimersByTimeAsync(PERIOD * 3)
        expect(primary.getLogs).toHaveBeenCalledTimes(1)

        await flushEventLoop()
        expect(unhandledRejections).toEqual([])
    })
})

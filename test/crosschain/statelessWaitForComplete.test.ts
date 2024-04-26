import { describe, expect, test } from 'vitest'
import {
    findThorChainDeposit,
    getThorTransactionStatus,
    tryToFindThorChainDepositAndWait,
    waitForThorChainTx,
} from '../../src/crosschain/statelessWaitForComplete/statelessWaitForComplete'
import { ChainId, Symbiosis } from '../../src'

describe('#getTransactionStatus', () => {
    test('ok', async () => {
        const btcHash = await getThorTransactionStatus('b2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd')

        expect(btcHash).toBe('A6F4FBA9CB25F7700F644D9B5753FCC51C7030B5C4B9F99ECFBB58225E74F9D7')
    })
    test('fail', async () => {
        const btcHash = await getThorTransactionStatus('incorrect_hash')

        expect(btcHash).toBe(undefined)
    })
})
describe('#waitForThorChainTx', () => {
    test('ok', async () => {
        const btcHash = await waitForThorChainTx('b2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd')

        expect(btcHash).toBe('A6F4FBA9CB25F7700F644D9B5753FCC51C7030B5C4B9F99ECFBB58225E74F9D7')
    })
    test('fail', async () => {
        const btcHash = await getThorTransactionStatus('incorrect_hash')

        expect(btcHash).toBe(undefined)
    })
})

const symbiosis = new Symbiosis('mainnet', 'test')

describe('#findThorChainDeposit', () => {
    test('ok', async () => {
        const ok = await findThorChainDeposit(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0xb2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd'
        )
        expect(ok).toBe(true)
    })
    test('fail', async () => {
        const ok = await findThorChainDeposit(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5'
        )
        expect(ok).toBe(false)
    })
})

describe('#tryToFindThorChainDepositAndWait', () => {
    test('ok', async () => {
        const ok = await tryToFindThorChainDepositAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0xb2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd'
        )
        expect(ok).toBe('A6F4FBA9CB25F7700F644D9B5753FCC51C7030B5C4B9F99ECFBB58225E74F9D7')
    })
    test('fail', async () => {
        const btcHash = await tryToFindThorChainDepositAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5'
        )
        expect(btcHash).toBe('0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5')
    })
})

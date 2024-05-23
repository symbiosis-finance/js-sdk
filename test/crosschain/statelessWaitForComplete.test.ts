import { describe, expect, test } from 'vitest'
import {
    findThorChainDeposit,
    getTransactionStatus,
    tryToFindExtraStepsAndWait,
    waitForThorChainTx,
} from '../../src/crosschain/statelessWaitForComplete'
import { ChainId, Symbiosis } from '../../src'

const symbiosis = new Symbiosis('mainnet', 'test')

describe('#waitAndFindThorChainDeposit', () => {
    test('ok', async () => {
        const ok = await tryToFindExtraStepsAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0xb2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd'
        )
        expect(ok).toBe('A6F4FBA9CB25F7700F644D9B5753FCC51C7030B5C4B9F99ECFBB58225E74F9D7')
    })
    test('fail', async () => {
        const btcHash = await tryToFindExtraStepsAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5'
        )
        expect(ok).toBe('0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5')
    })
})

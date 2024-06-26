import { describe, expect, test } from 'vitest'
import { ChainId, Symbiosis } from '../../src'
import { tryToFindExtraStepsAndWait } from '../../src/crosschain/statelessWaitForComplete/tryToFindExtraStepsAndWait'

const symbiosis = new Symbiosis('mainnet', 'test')

describe('#waitAndFindThorChainDeposit', () => {
    test('ok', async () => {
        const { outHash, extraStep } = await tryToFindExtraStepsAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0xb2230dbc77e0331959040f68971c2135bcd0377c00b55ccd1aff91f0a8752ddd'
        )
        expect(extraStep).toBe('thorChain')
        expect(outHash).toBe('A6F4FBA9CB25F7700F644D9B5753FCC51C7030B5C4B9F99ECFBB58225E74F9D7')
    })
    test('fail', async () => {
        const { outHash, extraStep } = await tryToFindExtraStepsAndWait(
            symbiosis,
            ChainId.ETH_MAINNET,
            '0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5'
        )
        expect(extraStep).toBe(undefined)
        expect(outHash).toBe('0x638a32caaa9f7171c799a9d7b675c9e56498918db54229f67184582dac0782b5')
    })
})

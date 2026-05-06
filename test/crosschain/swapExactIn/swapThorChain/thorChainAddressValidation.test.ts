import { describe, expect, test } from 'vitest'
import { ChainId } from '../../../../src/constants'
import { validateThorDestinationAddress } from '../../../../src/crosschain/swapExactIn/swapThorChain/thorChainAddressValidation'

describe('validateThorDestinationAddress', () => {
    test('accepts valid BTC mainnet address', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.BTC_MAINNET, 'bc1qn9esxuw8ca7ts8l6w66kdh800s09msvutydc46')
        ).not.toThrow()
    })

    test('rejects taproot BTC address', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.BTC_MAINNET, 'bc1pmzfrwwndsqmk5yh69yjr5lfgfg4ev8c0tsc06e')
        ).toThrow(/taproot/i)
    })

    test('accepts valid LTC bech32 and legacy addresses', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.LTC_MAINNET, 'ltc1qd2tpc6vjr3qj7n4q5s4xfwepkkdacwl4tcm9eg')
        ).not.toThrow()
        expect(() =>
            validateThorDestinationAddress(ChainId.LTC_MAINNET, 'LM2WMGZWvWmW8U3sX2Vfgs9MJ8qJzAYMJP')
        ).not.toThrow()
    })

    test('rejects invalid LTC address', () => {
        expect(() => validateThorDestinationAddress(ChainId.LTC_MAINNET, 'not-an-ltc-address')).toThrow()
    })

    test('rejects LTC taproot address', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.LTC_MAINNET, 'ltc1pmzfrwwndsqmk5yh69yjr5lfgfg4ev8c0xtest9')
        ).toThrow(/taproot/i)
    })

    test('accepts valid BCH cashaddr', () => {
        expect(() =>
            validateThorDestinationAddress(
                ChainId.BCH_MAINNET,
                'bitcoincash:qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a'
            )
        ).not.toThrow()
    })

    test('rejects malformed BCH address', () => {
        expect(() => validateThorDestinationAddress(ChainId.BCH_MAINNET, 'short')).toThrow()
    })

    test('accepts valid XRP classic address', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.XRP_MAINNET, 'rDNa7QrR3vXEAyzj44ZnTLm4M5wQ7w8nLW')
        ).not.toThrow()
    })

    test('rejects malformed XRP address', () => {
        expect(() => validateThorDestinationAddress(ChainId.XRP_MAINNET, 'qNotAValidXrpAddress')).toThrow()
    })

    test('accepts valid EVM address (ETH/AVAX/BSC/BASE)', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.ETH_MAINNET, '0x0000000000000000000000000000000000000001')
        ).not.toThrow()
        expect(() =>
            validateThorDestinationAddress(ChainId.BASE_MAINNET, '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')
        ).not.toThrow()
    })

    test('rejects malformed EVM address', () => {
        expect(() => validateThorDestinationAddress(ChainId.ETH_MAINNET, '0xnope')).toThrow(/EVM/i)
    })

    test('accepts valid DOGE legacy address', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.DOGE_MAINNET, 'DTnt7VZqR5ofHhAxZuDy4m9z6e2pSjA9DV')
        ).not.toThrow()
    })

    test('rejects malformed DOGE address', () => {
        expect(() => validateThorDestinationAddress(ChainId.DOGE_MAINNET, 'XnotDoge')).toThrow(/Dogecoin/i)
    })

    test('throws for non-EVM, non-native unsupported chain', () => {
        expect(() =>
            validateThorDestinationAddress(ChainId.SOLANA_MAINNET, 'AnyAddrHereBase58Solana')
        ).toThrow(/unsupported/i)
    })
})

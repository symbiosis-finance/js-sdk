import { validate as validateBitcoinAddress } from 'bitcoin-address-validation'

import { ChainId } from '../../constants'
import { InvalidAddressError } from '../sdkError'

// Per-chain deposit-address validators. Where a checksum-validating library
// exists in the SDK we use it; otherwise a format regex is sufficient to
// catch typos before funds land in a one-way receiving vault.
const DEPOSIT_ADDRESS_VALIDATORS: Partial<Record<ChainId, (address: string) => boolean>> = {
    // Bitcoin: full bech32/base58 checksum via bitcoin-address-validation.
    [ChainId.BTC_MAINNET]: validateBitcoinAddress,

    // Litecoin: legacy (L/M prefix), bech32 (ltc1)
    [ChainId.LTC_MAINNET]: matchesPattern(/^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{25,90}$/),

    // XRP Ledger: starts with r, 24-34 base58 chars
    [ChainId.XRP_MAINNET]: matchesPattern(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/),

    // Bitcoin Cash: legacy (1/3 prefix) or CashAddr (q/p prefix, optional bitcoincash: scheme)
    [ChainId.BCH_MAINNET]: matchesPattern(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^(bitcoincash:)?[qp][a-z0-9]{41,120}$/),

    // Dogecoin: starts with D, 34 base58 chars
    [ChainId.DOGE_MAINNET]: matchesPattern(/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/),

    // Zcash: transparent t1/t3 (35 base58), Sapling shielded zs1 (bech32, ~78 chars), Sprout shielded zc (base58, ~95 chars)
    [ChainId.ZCASH_MAINNET]: matchesPattern(
        /^t[13][1-9A-HJ-NP-Za-km-z]{33}$|^zs1[a-z0-9]{76}$|^zc[1-9A-HJ-NP-Za-km-z]{93}$/
    ),

    // Monero: 95 chars starting with 4 or 8 (standard) — integrated addresses are 106 chars
    [ChainId.XMR_MAINNET]: matchesPattern(/^[48][1-9A-HJ-NP-Za-km-z]{94}$/),
}

function matchesPattern(pattern: RegExp): (address: string) => boolean {
    return (address) => pattern.test(address)
}

export function isValidDepositAddress(chainId: ChainId, address: string): boolean {
    const validator = DEPOSIT_ADDRESS_VALIDATORS[chainId]
    if (!validator) return false
    return validator(address)
}

export function validateDepositAddress(chainId: ChainId, address: string): void {
    const validator = DEPOSIT_ADDRESS_VALIDATORS[chainId]
    if (!validator) {
        throw new InvalidAddressError(`No address validator registered for chain ${chainId}`)
    }
    if (!validator(address)) {
        throw new InvalidAddressError(`Invalid address for chain ${chainId}: ${address}`)
    }
}

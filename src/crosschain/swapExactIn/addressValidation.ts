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

    // Monero mainnet: 95 chars (standard) or 106 chars (integrated, +11 trailing).
    // Prefix [48][0-9AB] reflects the network-byte encoding for primary/subaddress on mainnet.
    [ChainId.XMR_MAINNET]: matchesPattern(/^[48][0-9AB][1-9A-HJ-NP-Za-km-z]{93}(?:[1-9A-HJ-NP-Za-km-z]{11})?$/),

    // Stellar: 56 chars starting with G (public key)
    [ChainId.XLM_MAINNET]: matchesPattern(/^G[A-Z2-7]{55}$/),

    // Cardano: Shelley addr1 (bech32), Byron Ae2 (base58)
    [ChainId.ADA_MAINNET]: matchesPattern(/^addr1[a-z0-9]{50,110}$|^Ae2[1-9A-HJ-NP-Za-km-z]{50,120}$/),

    // SUI: 66 chars hex with 0x prefix
    [ChainId.SUI_MAINNET]: matchesPattern(/^0x[a-fA-F0-9]{64}$/),

    // Canton (CC): participant::hex format (e.g. name-1::1220abcd...)
    [ChainId.CANTON_MAINNET]: matchesPattern(/^.+::[a-fA-F0-9]{40,}$/),
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

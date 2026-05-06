import { AddressType, getAddressInfo, validate as validateBtcLikeAddress } from 'bitcoin-address-validation'
import { isAddress as isEvmAddress } from '@ethersproject/address'

import { ChainId } from '../../../constants'
import { isEvmChainId } from '../../chainUtils'
import { ThorChainError } from '../../sdkError'

// XRP classic addresses: 25-35 chars, start with 'r', use Ripple's base58 alphabet
// The full alphabet is used in the character class (not sliced) so all valid chars including 'r' mid-address are accepted
const RIPPLE_BASE58_CHARS = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
const RIPPLE_REGEX = new RegExp(`^r[${RIPPLE_BASE58_CHARS}]{24,33}$`)

const BCH_CASHADDR_REGEX = /^(bitcoincash:)?(q|p)[a-z0-9]{40,42}$/

// Dogecoin legacy P2PKH (`D…`) and P2SH (`A…` or `9…`); base58check 25-34 chars
const DOGE_LEGACY_REGEX = /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/

function validateBtc(address: string): void {
    // Taproot addresses use bech32m encoding (bc1p prefix). The bitcoin-address-validation
    // library does not return true for validate() on taproot addresses, so we detect them
    // by prefix first to give a clear error message.
    if (/^(bc1p|tb1p|bcrt1p)/i.test(address)) {
        throw new ThorChainError(`ThorChain doesn't support taproot addresses`)
    }
    if (!validateBtcLikeAddress(address)) {
        throw new ThorChainError('Bitcoin address is not valid')
    }
    const info = getAddressInfo(address)
    if (info.type === AddressType.p2tr) {
        throw new ThorChainError(`ThorChain doesn't support taproot addresses`)
    }
}

function validateLtc(address: string): void {
    if (typeof address !== 'string' || address.length < 26 || address.length > 75) {
        throw new ThorChainError('Litecoin address is not valid')
    }
    if (/^(ltc1p|tltc1p|rltc1p)/i.test(address)) {
        throw new ThorChainError("ThorChain doesn't support LTC taproot addresses")
    }
    const isBech32 = /^(ltc1)[02-9ac-hj-np-z]{6,87}$/.test(address)
    const isLegacy = /^(L|M|3)[A-HJ-NP-Za-km-z1-9]{25,40}$/.test(address)
    if (!isBech32 && !isLegacy) {
        throw new ThorChainError('Litecoin address is not valid')
    }
}

function validateBch(address: string): void {
    if (typeof address !== 'string') {
        throw new ThorChainError('Bitcoin Cash address is not valid')
    }
    if (!BCH_CASHADDR_REGEX.test(address.toLowerCase())) {
        throw new ThorChainError('Bitcoin Cash address must be cashaddr format')
    }
}

function validateXrp(address: string): void {
    if (typeof address !== 'string' || !RIPPLE_REGEX.test(address)) {
        throw new ThorChainError('XRP address is not valid')
    }
}

function validateDoge(address: string): void {
    if (typeof address !== 'string' || !DOGE_LEGACY_REGEX.test(address)) {
        throw new ThorChainError('Dogecoin address is not valid')
    }
}

function validateEvm(address: string): void {
    if (!isEvmAddress(address)) {
        throw new ThorChainError('EVM address is not valid')
    }
}

const NATIVE_VALIDATORS: Partial<Record<ChainId, (address: string) => void>> = {
    [ChainId.BTC_MAINNET]: validateBtc,
    [ChainId.LTC_MAINNET]: validateLtc,
    [ChainId.BCH_MAINNET]: validateBch,
    [ChainId.XRP_MAINNET]: validateXrp,
    [ChainId.DOGE_MAINNET]: validateDoge,
}

export function validateThorDestinationAddress(chainId: ChainId, address: string): void {
    const validator = NATIVE_VALIDATORS[chainId]
    if (validator) {
        validator(address)
        return
    }
    if (isEvmChainId(chainId)) {
        validateEvm(address)
        return
    }
    throw new ThorChainError(`Unsupported destination chain for THORChain: ${chainId}`)
}

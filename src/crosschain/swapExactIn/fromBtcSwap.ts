import { SwapExactInParams, SwapExactInResult } from './types'
import { TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { isBtc } from '../utils'
import { isAddress } from 'ethers/lib/utils'

export const BTC_FORWARDER_API = {
    testnet: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
    mainnet: 'https://relayers.symbiosis.finance/forwarder/api/v1',
}

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { inTokenAmount, outToken, symbiosis } = context

    if (!isBtc(inTokenAmount.token.chainId)) {
        return false
    }

    try {
        const representation = symbiosis.getRepresentation(inTokenAmount.token, outToken.chainId)
        return !!representation && representation.equals(outToken)
    } catch {
        return false
    }
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { evmAccount, inTokenAmount, outToken } = context

    if (!evmAccount || (evmAccount && !isAddress(evmAccount))) {
        throw new Error('No returnable EVM address was provided')
    }

    // 1) [TODO]: Fee 2-nd synthesis, 3-rd from advisor in btc
    // 2) tail to next swap on evm

    const btcForwarderFeeSatoshi = await _getBtcForwarderFee(evmAccount)

    const { validUntil, revealAddress } = await _getDepositAddresses(evmAccount, btcForwarderFeeSatoshi)

    //[TODO]: minus all fees
    const totalTokenAmountOut = inTokenAmount.subtract(new TokenAmount(inTokenAmount.token, btcForwarderFeeSatoshi))

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut: new TokenAmount(outToken, totalTokenAmountOut.raw),
        },
        route: [],
        tokenAmountOut: new TokenAmount(outToken, totalTokenAmountOut.raw),
        approveTo: AddressZero,
        inTradeType: undefined,
        outTradeType: undefined,
        amountInUsd: undefined,
        fee: new TokenAmount(inTokenAmount.token, btcForwarderFeeSatoshi), // [TODO]: fee from upper tasks
        save: undefined,
        extraFee: undefined,
    }
}

interface DepositAddressResult {
    revealAddress: string
    validUntil: string
    legacyAddress: string
}

async function _getDepositAddresses(evmReceiverAddress: string, feeLimit: string): Promise<DepositAddressResult> {
    const wrapApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            to: evmReceiverAddress,
            fee: 0, // [TODO] Get from /portal minBtcFee (portal btc + evm synth execute metaMintSyntheticTokenBTC)
            op: 0, // 0 - is wrap operation
            sbfee: 0, // stable bridging fee for tail execution in satoshi
            tail: '', // calldata for next swap from contract SymBtc.FromBTCTransactionTail
        },
        feeLimit,
    })

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
    }

    const response = await fetch(`${wrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const data = await response.json()

    const { revealAddress, validUntil, legacyAddress } = data

    return {
        revealAddress,
        validUntil,
        legacyAddress,
    }
}

async function _getBtcForwarderFee(evmReceiverAddress: string): Promise<string> {
    const estimateWrapApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const raw = JSON.stringify({
        info: {
            op: 0, // 0 - wrap operation
            to: evmReceiverAddress,
        },
    })

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
    }

    const response = await fetch(`${estimateWrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const { feeLimit } = await response.json()

    return feeLimit
}

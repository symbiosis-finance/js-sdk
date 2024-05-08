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
        throw new Error('No EVM address was provided')
    }

    // 1) [TODO]: Fee 2-nd synthesis, 3-rd from advisor in btc
    // 2) tail to next swap on evm

    const btcForwarderFeeRaw = await _getBtcForwarderFee(evmAccount)

    const { validUntil, revealAddress } = await _getDepositAddresses(evmAccount, btcForwarderFeeRaw)

    const btcForwarderFee = new TokenAmount(inTokenAmount.token, btcForwarderFeeRaw)

    const totalTokenAmountOut = inTokenAmount.subtract(btcForwarderFee) //[TODO]: minus all fees
    const tokenAmountOut = new TokenAmount(outToken, totalTokenAmountOut.raw)

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut,
        },
        route: [inTokenAmount.token, outToken],
        tokenAmountOut,
        approveTo: AddressZero,
        inTradeType: undefined,
        outTradeType: undefined,
        amountInUsd: undefined,
        fee: btcForwarderFee,
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
    const minBtcFee = await _getMinBtcFee()

    const raw = JSON.stringify({
        info: {
            to: evmReceiverAddress,
            fee: minBtcFee, // [TODO] Get from /portal minBtcFee (portal btc + evm synth execute metaMintSyntheticTokenBTC)
            op: 0, // 0 - is wrap operation
            sbfee: 0, // stable bridging fee for tail execution in satoshi
            tail: '', // calldata for next swap from contract SymBtc.FromBTCTransactionTail
        },
        feeLimit,
    })

    const wrapApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
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

async function _getMinBtcFee(): Promise<string> {
    // kind of the state: 0=finalized 1=pending 2=best
    const portalApiUrl = new URL(`${BTC_FORWARDER_API.testnet}/portal?kind=0`)

    const response = await fetch(portalApiUrl)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const {
        state: { minBtcFee },
    } = await response.json()

    return minBtcFee
}

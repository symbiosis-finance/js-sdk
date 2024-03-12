import { SwapExactInParams, SwapExactInResult } from './types'
import { ChainId } from '../../constants'
import { TokenAmount } from '../../entities'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { BigNumber } from 'ethers'

const API: Partial<Record<ChainId, { forwarder: string; relayer: string }>> = {
    [ChainId.BTC_MAINNET]: {
        forwarder: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1', // FIXME
        relayer: 'https://relayers.testnet.symbiosis.finance/btc-relayer/api/v1', // FIXME
    },
    [ChainId.BTC_TESTNET]: {
        forwarder: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
        relayer: 'https://relayers.testnet.symbiosis.finance/btc-relayer/api/v1',
    },
}

// const symBTCAddress = '0x56d02ab3d1608f1b3e0a209224cefb978c801e20'

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken } = context

    const chainId = inTokenAmount.token.chainId

    const depositAddresses = await getDepositAddresses(chainId)
    console.log({ depositAddresses })

    const btcFee = await getBtcFee(chainId)
    console.log({ btcFee })

    const amount = '0'

    return {
        kind: 'btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: depositAddresses[0],
        },
        route: [],
        tokenAmountOut: new TokenAmount(outToken, amount),
        approveTo: AddressZero,
        inTradeType: undefined,
        outTradeType: undefined,
        amountInUsd: undefined,
        fee: undefined,
        save: undefined,
        extraFee: undefined,
    }
}

function getApi(chainId: ChainId) {
    const api = API[chainId]
    if (!api) {
        throw new Error(`ChainId ${chainId} is not supported`)
    }
    return api
}

async function getDepositAddresses(chainId: ChainId): Promise<string[]> {
    const api = getApi(chainId)
    const myHeaders = new Headers()
    myHeaders.append('accept', 'application/json')
    myHeaders.append('Content-Type', 'application/json')

    const raw = JSON.stringify({
        commitFee: 0,
        info: {
            fee: 0,
            sbfee: 0,
            tail: 'c3ltYmlvc2lzLmZpbmFuY2UK',
            to: '0x06FdD95756D48145389D66826eEdd872b178201b',
        },
        revealFee: 0,
    })

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: raw,
    }

    const response = await fetch(`${api.forwarder}/wrap`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const json = await response.json()
    return [json['data']['taprootAddress'], json['data']['legacyAddress']]
}

async function getBtcFee(chainId: ChainId): Promise<BigNumber> {
    const api = getApi(chainId)
    const myHeaders = new Headers()
    myHeaders.append('accept', 'application/json')
    myHeaders.append('Content-Type', 'application/json')

    const requestOptions = {
        method: 'GET',
        headers: myHeaders,
    }

    const response = await fetch(`${api.forwarder}/portal`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const json = await response.json()
    return BigNumber.from(json['FinalizedState']['MinBtcFee'])
}

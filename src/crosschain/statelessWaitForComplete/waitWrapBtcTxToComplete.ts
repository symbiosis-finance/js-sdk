import { BTC_FORWARDER_API } from './constants'
import { fetchData, longPolling } from './utils'

interface WrapTx {
    feeLimit: number
    info: {
        fee: number
        op: number
        sbfee: number
        tail: string
        to: string
    }
}
interface AddressInfo {
    legacyAddress: string
    revealAddress: string
    validUntil: string
    wrap: WrapTx
}

interface TransactionBtcInfo {
    commitOutputIdx: number
    commitTx: string
    incomeOutputIdx: number
    incomeTx: string
    revealTx: string
}

interface Block {
    blockHash: string
    blockTime: number
    confirmations: number
}

interface WrapOperation {
    btcFee: number
    revealInputIdx: number
    revealTx: string
    serial: number
    stableBridgingFee: number
    tail: string
    to: string
    value: number
}

interface BtcAddressResponse {
    addressInfo: AddressInfo
    transactions: TransactionBtcInfo[]
}
interface TxResponse {
    addressInfo: AddressInfo
    block: Block
    txInfo: TransactionBtcInfo
    wrap: WrapOperation
}

export class WaitWrapBtcTxToCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitWrapBtcTxToCompleteError'
    }
}

/**
 * @param btcAddress - btc wallet address which receive user's btc
 * @param blockConfirmations - how many blocks should we wait after transaction were mined
 * @returns Transaction hash
 */
export async function waitWrapBtcTxToComplete(btcAddress: string, blockConfirmations = 1): Promise<string | null> {
    const addressInfoUrl = new URL(`${BTC_FORWARDER_API.testnet}/address?address=${btcAddress}`)
    const txInfoUrl = new URL(`${BTC_FORWARDER_API.testnet}/tx`)

    let addressResponse: BtcAddressResponse | undefined
    let txResponse: TxResponse | undefined

    const result = await longPolling<TxResponse>({
        pollingFunction: async () => {
            if (!addressResponse?.transactions[0]?.revealTx) {
                addressResponse = await fetchData(addressInfoUrl)
                txInfoUrl.searchParams.append('txid', addressResponse!.transactions[0].revealTx)
            } else {
                txResponse = await fetchData(txInfoUrl)
            }

            return txResponse
        },
        successCondition: (txResponse) =>
            txResponse?.block?.confirmations ? txResponse.block.confirmations >= blockConfirmations : false,
        error: new WaitWrapBtcTxToCompleteError('waitWrapBtcTxToComplete timeout exceed'),
    })

    return result?.txInfo?.revealTx ?? null
}

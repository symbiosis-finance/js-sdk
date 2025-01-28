import { fetchData, longPolling } from './utils'
import { BtcConfig } from '../chainUtils/btc'

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

interface TxResponse {
    addressInfo: AddressInfo
    block: Block
    txInfo: TransactionBtcInfo
    wrap: WrapOperation
}

class WaitForCommitBtcTxError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForCommitBtcTxError'
    }
}

interface WaitForBtcCommitTxMinedParams {
    btcConfig: BtcConfig
    commitTx: string
    confirmations: number
    onConfirmation: (count: number) => void
}

export async function waitForBtcCommitTxMined({
    btcConfig,
    commitTx,
    confirmations,
    onConfirmation,
}: WaitForBtcCommitTxMinedParams): Promise<string | undefined> {
    const { forwarderUrl } = btcConfig
    const txInfoUrl = new URL(`${forwarderUrl}/tx`)
    txInfoUrl.searchParams.append('txid', commitTx)

    const txResponse = await longPolling<TxResponse>({
        pollingFunction: async () => {
            return fetchData(txInfoUrl)
        },
        successCondition: (response) => {
            const currentConfirmations = response?.block?.confirmations || 0
            onConfirmation(currentConfirmations)
            return currentConfirmations >= confirmations
        },
        error: new WaitForCommitBtcTxError('getting TxResponse timeout exceed'),
    })

    if (!txResponse || !txResponse.txInfo) {
        return
    }

    return txResponse.txInfo.commitTx
}

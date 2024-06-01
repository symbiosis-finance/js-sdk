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

interface TxResponse {
    addressInfo: AddressInfo
    block: Block
    txInfo: TransactionBtcInfo
    wrap: WrapOperation
}

class WaitForRevealBtcTxError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForRevealBtcTxError'
    }
}

export async function waitForBtcRevealTxMined(
    forwarderUrl: string,
    revealTx: string,
    blockConfirmations = 1
): Promise<string | undefined> {
    const txInfoUrl = new URL(`${forwarderUrl}/tx`)
    txInfoUrl.searchParams.append('txid', revealTx)

    const txResponse = await longPolling<TxResponse>({
        pollingFunction: async () => {
            return fetchData(txInfoUrl)
        },
        successCondition: (response) => (response?.block?.confirmations || 0) >= blockConfirmations,
        error: new WaitForRevealBtcTxError('getting TxResponse timeout exceed'),
    })

    if (!txResponse || !txResponse.txInfo) {
        return
    }

    return txResponse.txInfo.revealTx
}

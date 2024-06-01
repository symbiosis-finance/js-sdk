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

interface BtcAddressResponse {
    addressInfo: AddressInfo
    transactions: TransactionBtcInfo[]
}

export class WaitWrapBtcTxToCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitWrapBtcTxToCompleteError'
    }
}

export async function waitForBtcDepositAccepted(
    forwarderUrl: string,
    btcAddress: string
): Promise<{ commitTx: string; revealTx: string } | undefined> {
    const addressInfoUrl = new URL(`${forwarderUrl}/address?address=${btcAddress}`)
    const addressInfo = await longPolling<TransactionBtcInfo>({
        pollingFunction: async () => {
            const addressResponse: BtcAddressResponse = await fetchData(addressInfoUrl)
            if (addressResponse.transactions.length === 0) {
                return
            }
            return addressResponse.transactions[0]
        },
        successCondition: (txInfo) => !!txInfo,
        error: new WaitWrapBtcTxToCompleteError('getting TransactionBtcInfo timeout exceed'),
    })

    const { commitTx, revealTx } = addressInfo

    return { commitTx, revealTx }
}

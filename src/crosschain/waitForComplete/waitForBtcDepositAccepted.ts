import { fetchData, longPolling } from './utils'
import { BtcConfig } from '../chainUtils/btc'
import { BtcDepositAcceptedResult } from './types'

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
    btcConfig: BtcConfig,
    depositAddress: string
): Promise<BtcDepositAcceptedResult | undefined> {
    const { forwarderUrl } = btcConfig
    const addressInfoUrl = new URL(`${forwarderUrl}/address?address=${depositAddress}`)
    return longPolling<BtcDepositAcceptedResult | undefined>({
        pollingFunction: async () => {
            const addressResponse: BtcAddressResponse = await fetchData(addressInfoUrl)
            if (addressResponse.transactions.length === 0) {
                return
            }
            const { commitTx } = addressResponse.transactions[0]
            return {
                commitTx,
                btcConfig,
            }
        },
        successCondition: (txInfo) => !!txInfo,
        error: new WaitWrapBtcTxToCompleteError('getting TransactionBtcInfo timeout exceed'),
    })
}

import { BTC_FORWARDER_API } from './constants'
import { fetchData, longPolling } from './utils'

export class WaitUnwrapBtcTxComplete extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitUnwrapBtcTxComplete'
    }
}

interface UnwrapSerialBTCResponse {
    serial: number
    to: string
    tx: string
    value: number
    outputIdx: string
}

/**
 * @param burnSerialBTC - id from smart contract event BurnRequestBTC
 * @returns Transaction hash from portal contract in bitcoin network to user's wallet
 */
export async function waitUnwrapBtcTxComplete(burnSerialBTC: string): Promise<string | null> {
    if (!burnSerialBTC) {
        throw new Error('You have to pass btc tracking id')
    }
    const unwrapInfoUrl = new URL(`${BTC_FORWARDER_API.testnet}/unwrap?serial=${burnSerialBTC}`)

    const resut = await longPolling<UnwrapSerialBTCResponse>({
        pollingFunction: async () => {
            const serialBTCResponse = await fetchData(unwrapInfoUrl)

            return serialBTCResponse
        },
        successCondition: (result) => !!result?.outputIdx,
        error: new WaitUnwrapBtcTxComplete('waitUnwrapBtcTxComplete timeout exceed'),
    })

    return resut?.outputIdx
}

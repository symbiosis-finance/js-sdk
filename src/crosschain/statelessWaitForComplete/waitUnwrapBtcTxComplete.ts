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
 * @param forwarderUrl
 * @param burnSerialBTC - id from smart contract event BurnRequestBTC
 * @returns Transaction hash from portal contract in bitcoin network to user's wallet
 */
export async function waitUnwrapBtcTxComplete(forwarderUrl: string, burnSerialBTC: string): Promise<string | null> {
    if (!burnSerialBTC) {
        throw new Error('You have to pass btc tracking id')
    }
    const unwrapInfoUrl = new URL(`${forwarderUrl}/unwrap?serial=${burnSerialBTC}`)

    const resut = await longPolling<UnwrapSerialBTCResponse>({
        pollingFunction: async () => {
            const serialBTCResponse = await fetchData(unwrapInfoUrl)

            return serialBTCResponse
        },
        successCondition: (result) => !!result?.outputIdx,
        error: new WaitUnwrapBtcTxComplete('waitUnwrapBtcTxComplete timeout exceed'),
    })

    return resut?.tx
}

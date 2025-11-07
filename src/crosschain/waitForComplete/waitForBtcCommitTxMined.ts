import { fetchData, longPolling } from './utils'
import { BtcConfig } from '../types'

interface Wrap {
    commitTx: string
    wrap: {
        blockHeight: number
        btcFee: number
        offchainHash: string
        revealInputIdx: number
        revealTx: string
        serial: number
        stableBridgingFee: number
        tail: string
        to: string
        value: number
    }
}

interface WrapsResponse {
    wraps: Wrap[]
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
}

type Response = {
    blockHeight: number
    revealTx: string
}

export async function waitForBtcCommitTxMined({
    btcConfig,
    commitTx,
}: WaitForBtcCommitTxMinedParams): Promise<Response | undefined> {
    const { forwarderUrl } = btcConfig
    const wrapsUrl = new URL(`${forwarderUrl}/wraps`)
    wrapsUrl.searchParams.append('limit', '20')

    return longPolling<Response | undefined>({
        pollingFunction: async () => {
            const response: WrapsResponse = await fetchData(wrapsUrl)

            const found = response.wraps.find((w) => w.commitTx.toLowerCase() === commitTx.toLowerCase())
            if (!found) {
                return
            }

            const { blockHeight, revealTx } = found.wrap

            return {
                blockHeight,
                revealTx,
            }
        },
        successCondition: (response) => {
            if (!response) {
                return false
            }

            return response.blockHeight > -1
        },
        error: new WaitForCommitBtcTxError('getting /wraps timeout exceed'),
    })
}

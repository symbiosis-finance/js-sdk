export const BTC_FORWARDER_API = {
    testnet: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
    mainnet: 'https://relayers.symbiosis.finance/forwarder/api/v1',
}

export const POLLING_INTERVAL = 1000 * 10 // 10 seconds
export const DEFAULT_EXCEED_DELAY = 1000 * 60 * 20 // 20 minutes

export class TxNotFound extends Error {
    constructor(txId: string) {
        super(`Transaction ${txId} not found`)
        this.name = 'TxNotFound'
    }
}

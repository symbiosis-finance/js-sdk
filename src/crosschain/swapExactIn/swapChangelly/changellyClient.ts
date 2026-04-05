import crypto from 'crypto'

import { ChangellyError } from '../../sdkError'
import type { ChangellyConfig } from '../../types'
import type {
    CreateFixTransactionResponse,
    CurrencyFullResponse,
    FixRateForAmountResponse,
    PairsParamsResponse,
    TransactionResponse,
    TransactionStatus,
} from './types'

export class ChangellyClient {
    private readonly apiUrl: string
    private readonly privateKey: crypto.KeyObject | null
    private readonly apiKey: string | null
    private requestId = 0

    constructor(
        config: ChangellyConfig,
        private readonly fetchFn: typeof fetch
    ) {
        this.apiUrl = config.apiUrl
        if (config.privateKey) {
            this.privateKey = crypto.createPrivateKey({
                key: Buffer.from(config.privateKey, 'hex'),
                format: 'der',
                type: 'pkcs8',
            })
            const publicKey = crypto.createPublicKey(this.privateKey).export({
                type: 'pkcs1',
                format: 'der',
            })
            this.apiKey = crypto.createHash('sha256').update(publicKey).digest('base64')
        } else {
            this.privateKey = null
            this.apiKey = null
        }
    }

    private async request(method: string, params: object): Promise<any> {
        if (!this.privateKey || !this.apiKey) {
            throw new ChangellyError('Changelly private key is not configured')
        }

        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: ++this.requestId,
            method,
            params,
        })

        const signature = crypto.sign('sha256', Buffer.from(body), this.privateKey).toString('base64')

        const response = await this.fetchFn(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': this.apiKey,
                'X-Api-Signature': signature,
            },
            body,
        })

        const json = await response.json()
        if (json.error) {
            throw new ChangellyError(`Changelly API error: ${json.error.message ?? JSON.stringify(json.error)}`)
        }
        return json.result
    }

    public async getCurrenciesFull(): Promise<CurrencyFullResponse[]> {
        return this.request('getCurrenciesFull', {})
    }

    public async getFixRateForAmount(
        from: string,
        to: string,
        amountFrom: string
    ): Promise<FixRateForAmountResponse | undefined> {
        const result: FixRateForAmountResponse[] = await this.request('getFixRateForAmount', [{ from, to, amountFrom }])
        return result[0]
    }

    /**
     * @deprecated Changelly plans to remove this method.
     * Used as fallback to get min/max limits when getFixRateForAmount returns empty.
     * TODO: Replace when Changelly provides a proper limits endpoint.
     */
    public async getPairsParams(from: string, to: string): Promise<PairsParamsResponse | undefined> {
        const result: PairsParamsResponse[] = await this.request('getPairsParams', [{ from, to }])
        return result[0]
    }

    public async validateAddress(currency: string, address: string): Promise<boolean> {
        const result = await this.request('validateAddress', { currency, address })
        return result?.result ?? result === true
    }

    public async createFixTransaction(params: {
        from: string
        to: string
        address: string
        amountFrom: string
        rateId: string
        refundAddress: string
        extraIdTo?: string
    }): Promise<CreateFixTransactionResponse> {
        return this.request('createFixTransaction', params)
    }

    public async getStatus(changellyTxId: string): Promise<TransactionStatus> {
        return this.request('getStatus', { id: changellyTxId })
    }

    public async getTransaction(changellyTxId: string): Promise<TransactionResponse | undefined> {
        const result: TransactionResponse[] = await this.request('getTransactions', { id: changellyTxId })
        return result[0]
    }

    public async getTransactions(params: {
        id?: string | string[]
        status?: string | string[]
        currency?: string | string[]
        address?: string | string[]
        payoutAddress?: string | string[]
        extraId?: string
        since?: number
        before?: number
        limit?: number
        offset?: number
    }): Promise<TransactionResponse[]> {
        return this.request('getTransactions', params)
    }
}

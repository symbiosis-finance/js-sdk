// https://docs.changelly.com/fix/get-fix-rate-for-amount#response-parameters
export interface FixRateForAmountResponse {
    id: string
    result: string
    from: string
    to: string
    networkFee: string
    max: string
    maxFrom: string
    maxTo: string
    min: string
    minFrom: string
    minTo: string
    amountFrom: string
    amountTo: string
    expiredAt: number
}

// https://docs.changelly.com/fix/create-fix-transaction#response-parameters
export interface CreateFixTransactionResponse {
    id: string
    type: string
    payinAddress: string
    payinExtraId: string
    payoutAddress: string
    payoutExtraId: string
    refundAddress: string
    refundExtraId: string
    amountExpectedFrom: string
    amountExpectedTo: string
    status: string
    payTill: string
    currencyTo: string
    currencyFrom: string
    createdAt: number
    networkFee: string
}

// https://docs.changelly.com/currencies/get-currencies-full#response-parameters
export interface CurrencyFullResponse {
    name: string
    ticker: string
    fullName: string
    enabled: boolean
    enabledFrom: boolean
    enabledTo: boolean
    fixRateEnabled: boolean
    payinConfirmations: number
    addressUrl: string
    transactionUrl: string
    image: string
    fixedTime: number
    protocol: string
    blockchain: string
    blockchainPrecision: number
    contractAddress?: string
}

// https://docs.changelly.com/info/get-status
export type TransactionStatus =
    | 'waiting'
    | 'confirming'
    | 'exchanging'
    | 'sending'
    | 'finished'
    | 'failed'
    | 'refunded'
    | 'hold'
    | 'overdue'
    | 'expired'

// https://docs.changelly.com/info/get-transactions#response-parameters
export interface TransactionResponse {
    id: string
    createdAt: number
    type: string
    moneyReceived: number
    moneySent: number
    rate: string
    payinConfirmations: string
    status: TransactionStatus
    currencyTo: string
    currencyFrom: string
    payinAddress: string
    payinExtraId: string
    payinExtraIdName?: string
    payinHash: string
    payoutAddress: string
    payoutExtraId: string
    payoutExtraIdName?: string
    payoutHash: string
    payoutHashLink: string
    refundAddress: string
    refundExtraId: string
    refundHash: string
    refundHashLink: string
    amountExpectedFrom: string
    amountExpectedTo: string
    amountFrom: string
    amountTo: string
    networkFee: string
    changellyFee: string
    apiExtraFee: string
    totalFee: string
    canPush: boolean
    canRefund: boolean
    payTill: string
}

// https://docs.changelly.com/limits/get-pairs-params#response-parameters
export interface PairsParamsResponse {
    from: string
    to: string
    minAmountFloat: string
    maxAmountFloat: string
    minAmountFixed: string
    maxAmountFixed: string
}

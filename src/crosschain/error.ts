export enum ErrorCode {
    'DEFAULT',
    'NO_ROUTE',
    'AMOUNT_TOO_LOW',
    'AMOUNT_TOO_HIGH',
    'AMOUNT_LESS_THAN_FEE',
    'NO_TRANSIT_TOKEN',
}

export class Error {
    public code: ErrorCode
    public message?: string

    public constructor(message?: string, code?: ErrorCode) {
        this.code = code || ErrorCode.DEFAULT
        this.message = message
    }
}

export enum ErrorCode {
    'DEFAULT',
    'NO_REPRESENTATION_FOUND',
    'AMOUNT_LESS_THAN_FEE',
    'NO_TRANSIT_TOKEN',
    'MIN_THORCHAIN_AMOUNT_IN',
    'ADVISOR_ERROR',
    'AMOUNT_TOO_HIGH',
    'AMOUNT_TOO_LOW',
}

export class Error {
    public code: ErrorCode
    public message?: string

    public constructor(message?: string, code?: ErrorCode) {
        this.code = code || ErrorCode.DEFAULT
        this.message = message
    }
}

export enum ErrorCode {
    'DEFAULT',
    'NO_REPRESENTATION_FOUND',
    'AMOUNT_LESS_THAN_FEE',
    'NO_TRANSIT_TOKEN',
    'MIN_THORCHAIN_AMOUNT_IN',
    'ADVISOR_ERROR',
    'AMOUNT_TOO_HIGH',
    'AMOUNT_TOO_LOW',
    'MIN_TON_AMOUNT_IN',
    'THORCHAIN_NOT_SUPPORTED_ADDRESS',
    'MIN_CHAINFLIP_AMOUNT_IN',
}

export class Error {
    public code: ErrorCode
    public message?: string

    public constructor(message?: string, code?: ErrorCode) {
        this.code = code || ErrorCode.DEFAULT
        this.message = message
    }
}

enum SwapAggregatorErrorCategory {
    RateLimit = 'rate_limit',
    SwapAggregatorError = 'swap_aggregator_error',
    LiquidityError = 'liquidity_error',
    TokenError = 'token_error',
    BigIntError = 'bigint_error',
    ExceedPlan = 'exceed_plan',
    OracleError = 'oracle_error',
    Unknown = 'unknown',
}

const aggregatorCategoryPatterns: Record<SwapAggregatorErrorCategory, (string | RegExp)[]> = {
    [SwapAggregatorErrorCategory.RateLimit]: ['rate limit', 'too many requests', 'the limit of requests', /\b429\b/],
    [SwapAggregatorErrorCategory.SwapAggregatorError]: [
        'swap error', // 1inch
        'cannot create trade', // uni v2
        'no path found', // izumi
        'route not found', // uni v3
    ],
    [SwapAggregatorErrorCategory.OracleError]: ['oneinch oracle'],
    [SwapAggregatorErrorCategory.ExceedPlan]: ['plan has been exceeded'],
    [SwapAggregatorErrorCategory.LiquidityError]: ['insufficient liquidity', 'No avail liquidity'],
    [SwapAggregatorErrorCategory.BigIntError]: ['converted to bigint', 'to a bigint'],
    [SwapAggregatorErrorCategory.TokenError]: ['not valid token'],
    [SwapAggregatorErrorCategory.Unknown]: ['unknown'],
}

export function aggregatorErrorToText(reason: string) {
    const lowerCaseReason = reason.toLowerCase()

    for (const [category, patterns] of Object.entries(aggregatorCategoryPatterns) as [
        SwapAggregatorErrorCategory,
        (string | RegExp)[],
    ][]) {
        for (const pattern of patterns) {
            if (typeof pattern === 'string') {
                if (lowerCaseReason.includes(pattern.toLowerCase())) return category
            } else if (pattern.test(lowerCaseReason)) {
                return category
            }
        }
    }

    return SwapAggregatorErrorCategory.Unknown
}

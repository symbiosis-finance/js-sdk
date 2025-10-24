export class SdkError extends Error {
    constructor(message: string, cause?: unknown) {
        super(message)

        this.message = `[${this.constructor.name}] ${message}`
        this.name = this.constructor.name

        if (cause) {
            this.message = `${this.message}. Cause: ${this.unwrapCause(cause)}`
        }
    }

    private unwrapCause(cause: unknown): string {
        if (cause instanceof AggregateError) {
            const errors = cause.errors
                .map((e: unknown) => {
                    return this.unwrapCause(e)
                })
                .join(', ')
            return `${cause.message} [${errors}]`
        } else if (cause instanceof Error) {
            return cause.message
        } else if (typeof cause === 'string' && cause.length > 0) {
            return cause
        } else if (typeof cause === 'number') {
            return `${cause}`
        } else if (typeof cause === 'object') {
            return JSON.stringify(cause)
        } else {
            return 'Unknown'
        }
    }
}

// routing
export class RoutingError extends SdkError {}

export class NoTransitTokenError extends RoutingError {}

export class NoRepresentationFoundError extends RoutingError {}

// limits
export class LimitError extends SdkError {}

export class AmountTooLowError extends LimitError {}

export class AmountTooHighError extends LimitError {}

export class AmountLessThanFeeError extends LimitError {}

// advisor
export class AdvisorError extends SdkError {}

// ChainFlip
export class ChainFlipError extends SdkError {}

// trade
export class TradeError extends SdkError {}

export class WrapTradeError extends TradeError {}

export class UniV2TradeError extends TradeError {}

export class UniV3TradeError extends TradeError {}

export class IzumiTradeError extends TradeError {}

export class OpenOceanTradeError extends TradeError {}

export class OneInchTradeError extends TradeError {}

export class DedustTradeError extends TradeError {}

export class StonFiTradeError extends TradeError {}

export class RaydiumTradeError extends TradeError {}

export class JupiterTradeError extends TradeError {}

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
        (string | RegExp)[]
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

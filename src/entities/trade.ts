import invariant from 'tiny-invariant'

import { ONE, TradeType, ZERO } from '../constants'
import { sortedInsert } from '../utils'

import { TokenAmount } from './fractions/tokenAmount'
import { Fraction } from './fractions/fraction'
import { Percent } from './fractions/percent'
import { Price } from './fractions/price'
import { Pair } from './pair'
import { Route } from './route'
import { tokenEquals, Token, WETH } from './token'

/**
 * Returns the percent difference between the mid price and the execution price, i.e. price impact.
 * @param midPrice mid price before the trade
 * @param inputAmount the input amount of the trade
 * @param outputAmount the output amount of the trade
 */
function computePriceImpact(midPrice: Price, inputAmount: TokenAmount, outputAmount: TokenAmount): Percent {
    const exactQuote = midPrice.raw.multiply(inputAmount.raw)
    // calculate slippage := (exactQuote - outputAmount) / exactQuote
    const slippage = exactQuote.subtract(outputAmount.raw).divide(exactQuote)
    return new Percent(slippage.numerator, slippage.denominator)
}

// minimal interface so the input output comparator may be shared across types
interface InputOutput {
    readonly inputAmount: TokenAmount
    readonly outputAmount: TokenAmount
}

// comparator function that allows sorting trades by their output amounts, in decreasing order, and then input amounts
// in increasing order. i.e. the best trades have the most outputs for the least inputs and are sorted first
export function inputOutputComparator(a: InputOutput, b: InputOutput): number {
    // must have same input and output token for comparison
    invariant(tokenEquals(a.inputAmount.token, b.inputAmount.token), 'INPUT_CURRENCY')
    invariant(tokenEquals(a.outputAmount.token, b.outputAmount.token), 'OUTPUT_CURRENCY')
    if (a.outputAmount.equalTo(b.outputAmount)) {
        if (a.inputAmount.equalTo(b.inputAmount)) {
            return 0
        }
        // trade A requires less input than trade B, so A should come first
        if (a.inputAmount.lessThan(b.inputAmount)) {
            return -1
        } else {
            return 1
        }
    } else {
        // tradeA has less output than trade B, so should come second
        if (a.outputAmount.lessThan(b.outputAmount)) {
            return 1
        } else {
            return -1
        }
    }
}

// extension of the input output comparator that also considers other dimensions of the trade in ranking them
export function tradeComparator(a: Trade, b: Trade) {
    const ioComp = inputOutputComparator(a, b)
    if (ioComp !== 0) {
        return ioComp
    }

    // consider lowest slippage next, since these are less likely to fail
    if (a.priceImpact.lessThan(b.priceImpact)) {
        return -1
    } else if (a.priceImpact.greaterThan(b.priceImpact)) {
        return 1
    }

    // finally consider the number of hops since each hop costs gas
    return a.route.path.length - b.route.path.length
}

export interface BestTradeOptions {
    // how many results to return
    maxNumResults?: number
    // the maximum number of hops a trade should contain
    maxHops?: number
}

/**
 * Given a token amount and a chain ID, returns the equivalent representation as the token amount.
 */
export function wrappedAmount(tokenAmount: TokenAmount): TokenAmount {
    return tokenAmount.token.isNative ? new TokenAmount(WETH[tokenAmount.token.chainId], tokenAmount.raw) : tokenAmount
}

export function wrappedToken(token: Token): Token {
    return token.isNative ? WETH[token.chainId] : token
}

/**
 * Represents a trade executed against a list of pairs.
 * Does not account for slippage, i.e. trades that front run this trade and move the price.
 */
export class Trade {
    /**
     * The route of the trade, i.e. which pairs the trade goes through.
     */
    public readonly route: Route
    /**
     * The type of the trade, either exact in or exact out.
     */
    public readonly tradeType: TradeType
    /**
     * The input amount for the trade assuming no slippage.
     */
    public readonly inputAmount: TokenAmount
    /**
     * The output amount for the trade assuming no slippage.
     */
    public readonly outputAmount: TokenAmount
    /**
     * The price expressed in terms of output amount/input amount.
     */
    public readonly executionPrice: Price
    /**
     * The mid price after the trade executes assuming no slippage.
     */
    public readonly nextMidPrice: Price
    /**
     * The percent difference between the mid price before the trade and the trade execution price.
     */
    public readonly priceImpact: Percent

    /**
     * Constructs an exact in trade with the given amount in and route
     * @param route route of the exact in trade
     * @param amountIn the amount being passed in
     */
    public static exactIn(route: Route, amountIn: TokenAmount): Trade {
        return new Trade(route, amountIn, TradeType.EXACT_INPUT)
    }

    /**
     * Constructs an exact out trade with the given amount out and route
     * @param route route of the exact out trade
     * @param amountOut the amount returned by the trade
     */
    public static exactOut(route: Route, amountOut: TokenAmount): Trade {
        return new Trade(route, amountOut, TradeType.EXACT_OUTPUT)
    }

    public constructor(route: Route, amount: TokenAmount, tradeType: TradeType) {
        const amounts: TokenAmount[] = new Array(route.path.length)
        const nextPairs: Pair[] = new Array(route.pairs.length)
        if (tradeType === TradeType.EXACT_INPUT) {
            invariant(tokenEquals(amount.token, route.input), 'INPUT')
            amounts[0] = wrappedAmount(amount)
            for (let i = 0; i < route.path.length - 1; i++) {
                const pair = route.pairs[i]
                const [outputAmount, nextPair] = pair.getOutputAmount(amounts[i])
                amounts[i + 1] = outputAmount
                nextPairs[i] = nextPair
            }
        } else {
            invariant(tokenEquals(amount.token, route.output), 'OUTPUT')
            amounts[amounts.length - 1] = wrappedAmount(amount)
            for (let i = route.path.length - 1; i > 0; i--) {
                const pair = route.pairs[i - 1]
                const [inputAmount, nextPair] = pair.getInputAmount(amounts[i])
                amounts[i - 1] = inputAmount
                nextPairs[i - 1] = nextPair
            }
        }

        this.route = route
        this.tradeType = tradeType
        this.inputAmount = tradeType === TradeType.EXACT_INPUT ? amount : new TokenAmount(route.input, amounts[0].raw)
        this.outputAmount =
            tradeType === TradeType.EXACT_OUTPUT
                ? amount
                : new TokenAmount(route.output, amounts[amounts.length - 1].raw)
        this.executionPrice = new Price(
            this.inputAmount.token,
            this.outputAmount.token,
            this.inputAmount.raw,
            this.outputAmount.raw
        )
        this.nextMidPrice = Price.fromRoute(new Route(nextPairs, route.input))
        this.priceImpact = computePriceImpact(route.midPrice, this.inputAmount, this.outputAmount)
    }

    /**
     * Get the minimum amount that must be received from this trade for the given slippage tolerance
     * @param slippageTolerance tolerance of unfavorable slippage from the execution price of this trade
     */
    public minimumAmountOut(slippageTolerance: Percent): TokenAmount {
        invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
        if (this.tradeType === TradeType.EXACT_OUTPUT) {
            return this.outputAmount
        } else {
            const slippageAdjustedAmountOut = new Fraction(ONE)
                .add(slippageTolerance)
                .invert()
                .multiply(this.outputAmount.raw).quotient
            return new TokenAmount(this.outputAmount.token, slippageAdjustedAmountOut)
        }
    }

    /**
     * Get the maximum amount in that can be spent via this trade for the given slippage tolerance
     * @param slippageTolerance tolerance of unfavorable slippage from the execution price of this trade
     */
    public maximumAmountIn(slippageTolerance: Percent): TokenAmount {
        invariant(!slippageTolerance.lessThan(ZERO), 'SLIPPAGE_TOLERANCE')
        if (this.tradeType === TradeType.EXACT_INPUT) {
            return this.inputAmount
        } else {
            const slippageAdjustedAmountIn = new Fraction(ONE)
                .add(slippageTolerance)
                .multiply(this.inputAmount.raw).quotient
            return new TokenAmount(this.inputAmount.token, slippageAdjustedAmountIn)
        }
    }

    /**
     * Given a list of pairs, and a fixed amount in, returns the top `maxNumResults` trades that go from an input token
     * amount to an output token, making at most `maxHops` hops.
     * Note this does not consider aggregation, as routes are linear. It's possible a better route exists by splitting
     * the amount in among multiple routes.
     * @param pairs the pairs to consider in finding the best trade
     * @param tokenAmountIn exact amount of input token to spend
     * @param tokenOut the desired token out
     * @param maxNumResults maximum number of results to return
     * @param maxHops maximum number of hops a returned trade can make, e.g. 1 hop goes through a single pair
     * @param currentPairs used in recursion; the current list of pairs
     * @param originalAmountIn used in recursion; the original value of the tokenAmountIn parameter
     * @param bestTrades used in recursion; the current list of best trades
     */
    public static bestTradeExactIn(
        pairs: Pair[],
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
        // used in recursion.
        currentPairs: Pair[] = [],
        originalAmountIn: TokenAmount = tokenAmountIn,
        bestTrades: Trade[] = []
    ): Trade[] {
        invariant(pairs.length > 0, 'PAIRS')
        invariant(maxHops > 0, 'MAX_HOPS')
        invariant(originalAmountIn === tokenAmountIn || currentPairs.length > 0, 'INVALID_RECURSION')

        const amountIn = wrappedAmount(tokenAmountIn)
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i]
            // pair irrelevant
            if (!pair.token0.equals(amountIn.token) && !pair.token1.equals(amountIn.token)) continue
            if (pair.reserve0.equalTo(ZERO) || pair.reserve1.equalTo(ZERO)) continue

            let amountOut: TokenAmount
            try {
                ;[amountOut] = pair.getOutputAmount(amountIn)
            } catch (error: any) {
                // input too low
                if (error.isInsufficientInputAmountError) {
                    continue
                }
                throw error
            }
            // we have arrived at the output token, so this is the final trade of one of the paths
            if (amountOut.token.equals(wrappedToken(tokenOut))) {
                sortedInsert(
                    bestTrades,
                    new Trade(
                        new Route([...currentPairs, pair], originalAmountIn.token, tokenOut),
                        originalAmountIn,
                        TradeType.EXACT_INPUT
                    ),
                    maxNumResults,
                    tradeComparator
                )
            } else if (maxHops > 1 && pairs.length > 1) {
                const pairsExcludingThisPair = pairs.slice(0, i).concat(pairs.slice(i + 1, pairs.length))

                // otherwise, consider all the other paths that lead from this token as long as we have not exceeded maxHops
                Trade.bestTradeExactIn(
                    pairsExcludingThisPair,
                    amountOut,
                    tokenOut,
                    {
                        maxNumResults,
                        maxHops: maxHops - 1,
                    },
                    [...currentPairs, pair],
                    originalAmountIn,
                    bestTrades
                )
            }
        }

        return bestTrades
    }

    /**
     * similar to the above method but instead targets a fixed output amount
     * given a list of pairs, and a fixed amount out, returns the top `maxNumResults` trades that go from an input token
     * to an output token amount, making at most `maxHops` hops
     * note this does not consider aggregation, as routes are linear. it's possible a better route exists by splitting
     * the amount in among multiple routes.
     * @param pairs the pairs to consider in finding the best trade
     * @param tokenIn the token to spend
     * @param tokenAmountOut the exact amount of token out
     * @param maxNumResults maximum number of results to return
     * @param maxHops maximum number of hops a returned trade can make, e.g. 1 hop goes through a single pair
     * @param currentPairs used in recursion; the current list of pairs
     * @param originalAmountOut used in recursion; the original value of the currencyAmountOut parameter
     * @param bestTrades used in recursion; the current list of best trades
     */
    public static bestTradeExactOut(
        pairs: Pair[],
        tokenIn: Token,
        tokenAmountOut: TokenAmount,
        { maxNumResults = 3, maxHops = 3 }: BestTradeOptions = {},
        // used in recursion.
        currentPairs: Pair[] = [],
        originalAmountOut: TokenAmount = tokenAmountOut,
        bestTrades: Trade[] = []
    ): Trade[] {
        invariant(pairs.length > 0, 'PAIRS')
        invariant(maxHops > 0, 'MAX_HOPS')
        invariant(originalAmountOut === tokenAmountOut || currentPairs.length > 0, 'INVALID_RECURSION')

        const amountOut = wrappedAmount(tokenAmountOut)
        for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i]
            // pair irrelevant
            if (!pair.token0.equals(amountOut.token) && !pair.token1.equals(amountOut.token)) continue
            if (pair.reserve0.equalTo(ZERO) || pair.reserve1.equalTo(ZERO)) continue

            let amountIn: TokenAmount
            try {
                ;[amountIn] = pair.getInputAmount(amountOut)
            } catch (error: any) {
                // not enough liquidity in this pair
                if (error.isInsufficientReservesError) {
                    continue
                }
                throw error
            }
            // we have arrived at the input token, so this is the first trade of one of the paths
            if (amountIn.token.equals(wrappedToken(tokenIn))) {
                sortedInsert(
                    bestTrades,
                    new Trade(
                        new Route([pair, ...currentPairs], tokenIn, originalAmountOut.token),
                        originalAmountOut,
                        TradeType.EXACT_OUTPUT
                    ),
                    maxNumResults,
                    tradeComparator
                )
            } else if (maxHops > 1 && pairs.length > 1) {
                const pairsExcludingThisPair = pairs.slice(0, i).concat(pairs.slice(i + 1, pairs.length))

                // otherwise, consider all the other paths that arrive at this token as long as we have not exceeded maxHops
                Trade.bestTradeExactOut(
                    pairsExcludingThisPair,
                    tokenIn,
                    amountIn,
                    {
                        maxNumResults,
                        maxHops: maxHops - 1,
                    },
                    [pair, ...currentPairs],
                    originalAmountOut,
                    bestTrades
                )
            }
        }

        return bestTrades
    }
}

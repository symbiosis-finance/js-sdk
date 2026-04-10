import type { Token } from '../entities'
import { TokenAmount } from '../entities'

export interface SolverQuoteParams {
    tokenAmountIn: TokenAmount
    tokenOut: Token
}

export interface SolverQuoteResult {
    amountOut: TokenAmount
    quoteTTL: number // unix timestamp — the intent must be filled before this time
    fee: TokenAmount
}

export class SolverService {
    constructor(private readonly solverUrl: string) {}

    /**
     * Request a swap quote from the solver.
     * The solver responds with the amount of tokenOut it can provide for the given amountIn.
     *
     * TODO: Replace mock with actual HTTP call to the solver API:
     *   POST {solverUrl}/quote
     *   Body: { tokenIn: string, amountIn: string, tokenOut: string, chainIdIn: number, chainIdOut: number }
     *   Response: { amountOut: string, quoteTTL: number }
     */
    async quote({ tokenAmountIn, tokenOut }: SolverQuoteParams): Promise<SolverQuoteResult> {
        // MOCK IMPLEMENTATION — calls the solver API at this.solverUrl once it's deployed
        void this.solverUrl // will be used in the real implementation

        // Scale amountIn to tokenOut decimals and apply a 1% mock fee
        const decimalsDiff = tokenOut.decimals - tokenAmountIn.token.decimals
        const base = tokenAmountIn.toBigInt()
        const scaled = decimalsDiff >= 0 ? base * 10n ** BigInt(decimalsDiff) : base / 10n ** BigInt(-decimalsDiff)
        const fee = new TokenAmount(tokenOut, (scaled * 1n) / 100n)
        const amountOut = new TokenAmount(tokenOut, (scaled * 99n) / 100n)

        return {
            amountOut,
            quoteTTL: Math.floor(Date.now() / 1000) + 600, // 10-minute TTL
            fee,
        }
    }
}

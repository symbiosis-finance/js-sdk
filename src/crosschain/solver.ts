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

    async quote({ tokenAmountIn, tokenOut }: SolverQuoteParams): Promise<SolverQuoteResult> {
        const response = await fetch(`${this.solverUrl}/quote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tokenIn: tokenAmountIn.token.address,
                amountIn: tokenAmountIn.toBigInt().toString(),
                tokenOut: tokenOut.address,
                srcChainId: tokenAmountIn.token.chainId,
                dstChainId: tokenOut.chainId,
            }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error ?? `Solver quote failed: ${response.status}`)
        }

        const data: { amountOut: string; ttl: number; fee: string } = await response.json()

        return {
            amountOut: new TokenAmount(tokenOut, BigInt(data.amountOut)),
            quoteTTL: data.ttl,
            fee: new TokenAmount(tokenOut, BigInt(data.fee)),
        }
    }
}

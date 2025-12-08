import { ChainId } from '../constants'
import type { Token, TokenAmount } from '../entities'

interface TokensInAndOut {
    tokenAmountIn: TokenAmount
    tokenOut: Token
}

export function isUseOneInchOnly(context: TokensInAndOut): boolean {
    return [context.tokenAmountIn.token.chainId, context.tokenOut.chainId].some((i) => i === ChainId.TRON_MAINNET)
}

export function getAmountBucket(amount: number): number {
    const amountBuckets = [
        0.001, 0.01, 0.1, 0.5, 1, 5, 10, 50, 100, 1000, 3000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000,
        1_000_000,
    ]
    let minDifference = Math.abs(amount - amountBuckets[0])
    let bucket = amountBuckets[0]
    for (const amountBucket of amountBuckets) {
        const diff = Math.abs(amount - amountBucket)
        if (diff < minDifference) {
            minDifference = diff
            bucket = amountBucket
        }
    }

    return bucket
}

export function formatTokenName(token: Token) {
    const chainName = (token.chainFrom || token.chain)!.name
    return `${token.symbol}:${chainName}:${token.address.toLowerCase()}`
}

import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { CrosschainSwapExactInResult } from '../baseSwapping'
import { Error, ErrorCode } from '../error'

export async function tonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    const promises = context.symbiosis.config.omniPools.map((pool) => {
        const zappingTon = context.symbiosis.newZappingTon(pool)
        return zappingTon.exactIn({
            tokenAmountIn: inTokenAmount,
            from: context.fromAddress,
            to: context.toAddress,
            slippage: context.slippage,
            deadline: context.deadline,
        })
    })

    const results = await Promise.allSettled(promises)

    let bestResult: CrosschainSwapExactInResult | undefined
    const errors: Error[] = []

    for (const item of results) {
        if (item.status !== 'fulfilled') {
            errors.push(item.reason)
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    // TODO remove duplicate code
    if (!bestResult) {
        const uniqueCodes = errors
            .map((i) => i.code)
            .reduce((acc, i) => {
                if (!acc.includes(i)) {
                    acc.push(i)
                }
                return acc
            }, [] as ErrorCode[])

        // if all errors are same return first of them
        if (uniqueCodes.length === 1) {
            throw errors[0]
        }
        // skip no transit token error (no chains pair)
        const otherErrors = errors.filter((e) => {
            return e.code !== ErrorCode.NO_TRANSIT_TOKEN
        })

        if (otherErrors.length > 0) {
            throw otherErrors[0]
        }
        throw errors[0]
    }

    const payload = {
        transactionType: bestResult.type,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...bestResult,
        ...payload,
    }
}

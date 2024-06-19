import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { CrosschainSwapExactInResult } from '../baseSwappingImplementation'
import { Error } from '../error'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken, symbiosis, fromAddress, toAddress, slippage, deadline } = context

    const promises: Promise<CrosschainSwapExactInResult>[] = []

    symbiosis.config.chains.forEach((chain) => {
        const sBtc = symbiosis.getRepresentation(outToken, chain.id)
        if (!sBtc) {
            return
        }
        symbiosis.config.omniPools.forEach((poolConfig) => {
            const zappingBtc = symbiosis.newZappingBtc(poolConfig)

            const promise = zappingBtc.exactIn({
                tokenAmountIn: inTokenAmount,
                sBtc,
                from: fromAddress,
                to: toAddress,
                slippage,
                deadline,
            })
            promises.push(promise)
        })
    })

    const results = await Promise.allSettled(promises)

    let bestResult: CrosschainSwapExactInResult | undefined
    let error: Error | undefined
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            error = item.reason
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    if (!bestResult) {
        throw error
    }

    const payload = {
        transactionType: bestResult.type,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...bestResult,
        ...payload,
        zapType: 'btc-bridge',
    }
}

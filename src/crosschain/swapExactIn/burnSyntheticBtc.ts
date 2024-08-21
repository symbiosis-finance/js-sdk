import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { BaseSwappingExactInResult } from '../baseSwapping'
import { Error, ErrorCode } from '../error'
import { selectError } from '../utils'
import { UnwrapBtc } from '../unwrapBtc'
import { TokenAmount } from '../../entities'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken, symbiosis, fromAddress, toAddress, slippage, deadline } = context

    const promises: Promise<BaseSwappingExactInResult>[] = []

    symbiosis.config.chains.forEach((chain) => {
        const sBtc = symbiosis.getRepresentation(outToken, chain.id)
        if (!sBtc) {
            return
        }

        if (inTokenAmount.token.equals(sBtc)) {
            const burn = new UnwrapBtc(symbiosis)
            promises.push(
                burn.exactIn({
                    tokenAmountIn: new TokenAmount(sBtc, inTokenAmount.raw),
                    to: toAddress,
                })
            )
            return
        }

        symbiosis.config.omniPools.forEach((poolConfig) => {
            const transitTokensIn = symbiosis.transitTokens(inTokenAmount.token.chainId, poolConfig)
            const transitTokensOut = symbiosis.transitTokens(sBtc.chainId, poolConfig)

            transitTokensIn.forEach((transitTokenIn) => {
                transitTokensOut.forEach((transitTokenOut) => {
                    if (transitTokenIn.equals(transitTokenOut)) {
                        return
                    }
                    const zappingBtc = symbiosis.newZappingBtc(poolConfig)

                    const promise = zappingBtc.exactIn({
                        tokenAmountIn: inTokenAmount,
                        sBtc,
                        from: fromAddress,
                        to: toAddress,
                        slippage,
                        deadline,
                        transitTokenIn,
                        transitTokenOut,
                    })
                    promises.push(promise)
                })
            })
        })
    })

    if (promises.length === 0) {
        throw new Error(`No route`, ErrorCode.NO_TRANSIT_TOKEN)
    }

    const results = await Promise.allSettled(promises)

    let bestResult: BaseSwappingExactInResult | undefined
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

    if (!bestResult) {
        throw selectError(errors)
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

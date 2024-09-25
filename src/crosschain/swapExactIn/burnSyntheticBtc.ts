import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../types'
import { Error, ErrorCode } from '../error'
import { selectError } from '../utils'
import { UnwrapBtc } from '../unwrapBtc'
import { TokenAmount } from '../../entities'
import { zappingBtcOnChain } from '../zappingBtcOnChain'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, from, to, slippage, deadline } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.chains.forEach((chain) => {
        const sBtc = symbiosis.getRepresentation(tokenOut, chain.id)
        if (!sBtc) {
            return
        }

        if (tokenAmountIn.token.equals(sBtc)) {
            const burn = new UnwrapBtc(symbiosis)
            promises.push(
                burn.exactIn({
                    tokenAmountIn: new TokenAmount(sBtc, tokenAmountIn.raw),
                    to,
                })
            )
            return
        }

        if (tokenAmountIn.token.chainId === sBtc.chainId) {
            promises.push(zappingBtcOnChain(context))
            return
        }

        symbiosis.config.omniPools.forEach((poolConfig) => {
            const transitTokensIn = symbiosis.transitTokens(tokenAmountIn.token.chainId, poolConfig)
            const transitTokensOut = symbiosis.transitTokens(sBtc.chainId, poolConfig)

            transitTokensIn.forEach((transitTokenIn) => {
                transitTokensOut.forEach((transitTokenOut) => {
                    if (transitTokenIn.equals(transitTokenOut)) {
                        return
                    }
                    const zappingBtc = symbiosis.newZappingBtc(poolConfig)

                    const promise = zappingBtc.exactIn({
                        tokenAmountIn,
                        sBtc,
                        from,
                        to,
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

    let bestResult: SwapExactInResult | undefined
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
        transactionType: bestResult.transactionType,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        ...bestResult,
        ...payload,
        kind: 'crosschain-swap',
    }
}

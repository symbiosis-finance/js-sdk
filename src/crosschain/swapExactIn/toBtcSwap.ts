import { SwapExactInParams, SwapExactInResult } from './types'
import { thorChainSwap } from './thorChainSwap'
import { burnSyntheticBtc } from './burnSyntheticBtc'
import { isBtc, selectError } from '../utils'
import { Error } from '../error'
import { ChainId } from '../../constants'

function isThorChainAvailable(chainId: ChainId) {
    return chainId === ChainId.BTC_MAINNET
}

function isNativeAvailable(chainId: ChainId) {
    return false
    return isBtc(chainId)
}

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { outToken } = context

    return isThorChainAvailable(outToken.chainId) || isNativeAvailable(outToken.chainId)
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { outToken } = context

    const promises = []
    if (isNativeAvailable(outToken.chainId)) {
        promises.push(burnSyntheticBtc(context))
    }
    if (isThorChainAvailable(outToken.chainId)) {
        promises.push(thorChainSwap(context))
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

    return bestResult
}

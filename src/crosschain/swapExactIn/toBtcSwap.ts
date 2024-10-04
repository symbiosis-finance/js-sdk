import { SwapExactInParams, SwapExactInResult } from '../types'
import { thorChainSwap } from './thorChainSwap'
import { burnSyntheticBtc } from './burnSyntheticBtc'
import { isBtcChainId } from '../utils'
import { ChainId } from '../../constants'
import { theBestOutput } from './utils'

function isThorChainAvailable(chainId: ChainId) {
    return chainId === ChainId.BTC_MAINNET
}

function isNativeAvailable(chainId: ChainId) {
    return isBtcChainId(chainId)
}

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { tokenOut } = context

    return isThorChainAvailable(tokenOut.chainId) || isNativeAvailable(tokenOut.chainId)
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenOut } = context

    const promises = []
    if (isNativeAvailable(tokenOut.chainId)) {
        promises.push(burnSyntheticBtc(context))
    }
    if (isThorChainAvailable(tokenOut.chainId)) {
        promises.push(thorChainSwap(context))
    }

    return theBestOutput(promises)
}

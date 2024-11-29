import { SwapExactInParams, SwapExactInResult } from '../types'
import { thorChainSwap } from './thorChainSwap'
import { burnSyntheticBtc } from './toBtc/burnSyntheticBtc'
import { ChainId } from '../../constants'
import { theBest } from './utils'
import { isBtcChainId } from '../chainUtils'

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
    const { tokenOut, symbiosis } = context

    const promises = []
    if (isNativeAvailable(tokenOut.chainId)) {
        promises.push(burnSyntheticBtc(context))
    }
    if (isThorChainAvailable(tokenOut.chainId)) {
        promises.push(thorChainSwap(context))
    }

    return theBest(promises, symbiosis.selectMode)
}

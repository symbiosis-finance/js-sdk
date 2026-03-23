import type { ChainId } from '../../constants'
import { isSolanaChainId } from '../chainUtils'
import { SymbiosisTradeType } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { fromSolanaChainFlipSwap } from './swapChainFlip'
import { theBest } from './utils'

function isChainFlipAvailable(chainId: ChainId) {
    return isSolanaChainId(chainId)
}

export function isFromSolanaSwapSupported(context: SwapExactInParams): boolean {
    const {
        tokenAmountIn: { token },
    } = context

    return isChainFlipAvailable(token.chainId)
}

export async function fromSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const {
        tokenAmountIn: { token },
        selectMode,
        disabledProviders,
    } = context

    const promises = []
    if (isChainFlipAvailable(token.chainId) && !disabledProviders?.includes(SymbiosisTradeType.CHAINFLIP_BRIDGE)) {
        promises.push(fromSolanaChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

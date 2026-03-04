import type { ChainId } from '../../constants'
import { isSolanaChainId } from '../chainUtils'
import { SymbiosisTradeType } from '../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { solanaChainFlipSwap } from './swapChainFlip'
import { theBest } from './utils'

function isChainFlipAvailable(chainId: ChainId) {
    return isSolanaChainId(chainId)
}

export function isToSolanaSwapSupported(context: SwapExactInParams): boolean {
    const { tokenOut } = context

    return isChainFlipAvailable(tokenOut.chainId)
}

export async function toSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenOut, selectMode, disabledProviders } = context

    const promises = []
    if (isChainFlipAvailable(tokenOut.chainId) && !disabledProviders?.includes(SymbiosisTradeType.CHAINFLIP_BRIDGE)) {
        promises.push(solanaChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

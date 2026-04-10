import { isSolanaChainId } from '../chainUtils'
import { SymbiosisTradeType } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { fromSolanaChainFlipSwap } from './swapChainFlip'
import { theBest } from './utils'

export function isFromSolanaSwapSupported(context: SwapExactInParams): boolean {
    return isSolanaChainId(context.tokenAmountIn.token.chainId)
}

export async function fromSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode, disabledProviders } = context

    const promises: Promise<SwapExactInResult>[] = []
    if (!disabledProviders?.includes(SymbiosisTradeType.CHAINFLIP_BRIDGE)) {
        promises.push(fromSolanaChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

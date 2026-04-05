import { isSolanaChainId } from '../chainUtils'
import { SymbiosisTradeType } from '../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { solanaChainFlipSwap } from './swapChainFlip'
import { theBest } from './utils'

export function isToSolanaSwapSupported(context: SwapExactInParams): boolean {
    return isSolanaChainId(context.tokenOut.chainId)
}

export async function toSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode, disabledProviders } = context

    const promises: Promise<SwapExactInResult>[] = []
    if (!disabledProviders?.includes(SymbiosisTradeType.CHAINFLIP_BRIDGE)) {
        promises.push(solanaChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

import { isSolanaChainId } from '../chainUtils'
import { TradeProvider } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { fromSolanaChainFlipSwap } from './chainFlipSwap'

export function isFromSolanaSwapSupported(context: SwapExactInParams): boolean {
    return isSolanaChainId(context.tokenAmountIn.token.chainId)
}

export function fromSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    const { disabledProviders } = context

    const promises: Promise<SwapExactInResult>[] = []
    if (!disabledProviders?.includes(TradeProvider.CHAINFLIP_BRIDGE)) {
        promises.push(...fromSolanaChainFlipSwap(context))
    }

    return promises
}

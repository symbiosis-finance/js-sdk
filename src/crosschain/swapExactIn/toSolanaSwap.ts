import { isSolanaChainId } from '../chainUtils'
import { TradeProvider } from '../trade'
import { withPromisesSpan } from '../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { solanaChainFlipSwap } from './chainFlipSwap'

export function isToSolanaSwapSupported(context: SwapExactInParams): boolean {
    return isSolanaChainId(context.tokenOut.chainId)
}

export function toSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('toSolanaSwap', {}, () => {
        const { disabledProviders } = context

        const promises: Promise<SwapExactInResult>[] = []
        if (!disabledProviders?.includes(TradeProvider.CHAINFLIP_BRIDGE)) {
            promises.push(...solanaChainFlipSwap(context))
        }

        return promises
    })
}

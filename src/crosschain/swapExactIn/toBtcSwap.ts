import { isBtcChainId } from '../chainUtils'
import { TradeProvider } from '../trade'
import { withPromisesSpan } from '../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { btcChainFlipSwap } from './chainFlipSwap'
import { thorChainSwap } from './thorChainSwap'
import { symbiosisBtcSwap } from './symbiosisBtcSwap/symbiosisBtcSwap'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    return isBtcChainId(context.tokenOut.chainId)
}

export function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('toBtcSwap', {}, () => {
        const { disabledProviders } = context

        const promises: Promise<SwapExactInResult>[] = [...symbiosisBtcSwap(context)]

        if (!disabledProviders?.includes(TradeProvider.THORCHAIN_BRIDGE)) {
            promises.push(...thorChainSwap(context))
        }
        if (!disabledProviders?.includes(TradeProvider.CHAINFLIP_BRIDGE)) {
            promises.push(...btcChainFlipSwap(context))
        }

        return promises
    })
}

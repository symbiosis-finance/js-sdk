import { isBtcChainId } from '../chainUtils'
import { TradeProvider } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { btcChainFlipSwap } from './chainFlipSwap'
import { thorChainSwap } from './thorChainSwap'
import { symbiosisBtcSwap } from './symbiosisBtcSwap/symbiosisBtcSwap'
import { theBest } from './utils'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    return isBtcChainId(context.tokenOut.chainId)
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { selectMode, disabledProviders } = context

    const promises: Promise<SwapExactInResult>[] = []

    promises.push(symbiosisBtcSwap(context))

    if (!disabledProviders?.includes(TradeProvider.THORCHAIN_BRIDGE)) {
        promises.push(thorChainSwap(context))
    }
    if (!disabledProviders?.includes(TradeProvider.CHAINFLIP_BRIDGE)) {
        promises.push(btcChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

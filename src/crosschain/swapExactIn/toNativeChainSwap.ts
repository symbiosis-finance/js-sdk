import { ChainId } from '../../constants'
import { SymbiosisTradeType } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { changellyNativeSwap } from './swapChangelly'
import { isThorChainDestinationChainId, thorChainSwap } from './swapThorChain'
import { theBest } from './utils'

// Native-chain destinations served by this dispatcher. BTC is owned by toBtcSwap (which
// already runs the burnSyntheticBtc + THORChain + ChainFlip race).
const NATIVE_CHAIN_DESTINATIONS = new Set<ChainId>([
    ChainId.LTC_MAINNET,
    ChainId.BCH_MAINNET,
    ChainId.XRP_MAINNET,
    ChainId.DOGE_MAINNET,
    ChainId.XMR_MAINNET,
    ChainId.ZCASH_MAINNET,
])

export function isToNativeChainSwapSupported(context: SwapExactInParams): boolean {
    if (context.tokenAmountIn.token.chainId === ChainId.BTC_MAINNET) return false
    return NATIVE_CHAIN_DESTINATIONS.has(context.tokenOut.chainId)
}

export async function toNativeChainSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenOut, selectMode, disabledProviders } = context

    const promises: Promise<SwapExactInResult>[] = []

    // THORChain only when the destination has a THORChain pool (LTC/BCH/XRP/DOGE have pools;
    // XMR/ZEC don't, so this branch is skipped for those — Changelly serves them alone).
    if (
        !disabledProviders?.includes(SymbiosisTradeType.THORCHAIN_BRIDGE) &&
        isThorChainDestinationChainId(tokenOut.chainId)
    ) {
        promises.push(thorChainSwap(context))
    }
    if (!disabledProviders?.includes(SymbiosisTradeType.CHANGELLY)) {
        promises.push(changellyNativeSwap(context))
    }

    return theBest(promises, selectMode)
}

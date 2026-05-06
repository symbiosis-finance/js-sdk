import { ChainId } from '../../constants'
import { SymbiosisTradeType } from '../trade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { changellyNativeSwap, isChangellyNativeChainId, isChangellyNativeSupported } from './swapChangelly'
import {
    isThorChainDestinationToken,
    isThorChainNativeSourceChainId,
    thorChainSwap,
} from './swapThorChain'
import { theBest } from './utils'

// FROM-side dispatcher for non-BTC native L1 sources (LTC/BCH/XRP/DOGE/XMR/ZEC).
// BTC source is excluded because THORCHAIN_CHAIN_MAP (isNativeL1) and CHANGELLY_NATIVE_CHAINS
// both omit BTC. BTC destination is excluded explicitly so LTC→BTC etc. fall through
// to toBtcSwap (which races burnSyntheticBtc + THORChain + ChainFlip).
export function isFromNativeChainSwapSupported(params: SwapExactInParams): boolean {
    const fromChainId = params.tokenAmountIn.token.chainId
    if (params.tokenOut.chainId === ChainId.BTC_MAINNET) return false
    return isThorChainNativeSourceChainId(fromChainId) || isChangellyNativeChainId(fromChainId)
}

function isThorChainDepositRouteSupported(params: SwapExactInParams): boolean {
    if (params.disabledProviders?.includes(SymbiosisTradeType.THORCHAIN_BRIDGE)) return false
    if (!isThorChainNativeSourceChainId(params.tokenAmountIn.token.chainId)) return false
    return isThorChainDestinationToken(params.tokenOut)
}

export async function fromNativeChainSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const promises: Promise<SwapExactInResult>[] = []

    if (isThorChainDepositRouteSupported(params)) {
        promises.push(thorChainSwap(params))
    }
    if (isChangellyNativeSupported(params)) {
        promises.push(changellyNativeSwap(params))
    }

    return theBest(promises, params.selectMode)
}

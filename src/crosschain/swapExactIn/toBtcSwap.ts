import { ChainId } from '../../constants'
import { isBtcChainId } from '../chainUtils'
import { SymbiosisTradeType } from '../trade/symbiosisTrade'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { btcChainFlipSwap } from './swapChainFlip'
import { thorChainSwap } from './thorChainSwap'
import { burnSyntheticBtc } from './toBtc/burnSyntheticBtc'
import { theBest } from './utils'

function isThorChainAvailable(chainId: ChainId) {
    return chainId === ChainId.BTC_MAINNET
}

function isNativeAvailable(chainId: ChainId) {
    return isBtcChainId(chainId)
}

function isChainFlipAvailable(chainId: ChainId) {
    return isBtcChainId(chainId)
}

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { tokenOut } = context

    return isThorChainAvailable(tokenOut.chainId) || isNativeAvailable(tokenOut.chainId)
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenOut, selectMode, disabledProviders } = context

    const promises = []
    if (isNativeAvailable(tokenOut.chainId)) {
        promises.push(burnSyntheticBtc(context))
    }
    if (isThorChainAvailable(tokenOut.chainId) && !disabledProviders?.includes(SymbiosisTradeType.THORCHAIN_BRIDGE)) {
        promises.push(thorChainSwap(context))
    }
    if (isChainFlipAvailable(tokenOut.chainId) && !disabledProviders?.includes(SymbiosisTradeType.CHAINFLIP_BRIDGE)) {
        promises.push(btcChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

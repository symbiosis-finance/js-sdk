import { isTonChainId, isTronChainId, tronAddressToEvm } from '../chainUtils'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { bridge, isBridgeSupported } from './bridge'
import { crosschainSwap } from './crosschainSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { fromBtcSwap, isFromBtcSwapSupported } from './fromBtcSwap'
import { isOnchainSwapSupported, onchainSwap } from './onchainSwap'
import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap'
import { isToSolanaSwapSupported, toSolanaSwap } from './toSolanaSwap'
import { toTonSwap } from './toTonSwap'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'

export * from './fromBtcSwap'

// Universal stateless function that allows swap tokens on same chain or crosschain
export async function swapExactIn(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut } = params

    if (isTronChainId(tokenAmountIn.token.chainId)) {
        params.from = tronAddressToEvm(params.from)
    }
    if (isTronChainId(tokenOut.chainId)) {
        params.to = tronAddressToEvm(params.to)
    }

    if (tokenAmountIn.token.equals(tokenOut)) {
        throw new Error('Cannot swap same tokens')
    }

    if (isWrapSupported(params)) {
        return wrap(params)
    }

    if (isUnwrapSupported(params)) {
        return unwrap(params)
    }

    if (isOnchainSwapSupported(params)) {
        if (isFeeCollectorSwapSupported(params)) {
            return feeCollectorSwap(params)
        }

        return onchainSwap(params)
    }

    if (isFromBtcSwapSupported(params)) {
        return fromBtcSwap(params)
    }

    if (isToBtcSwapSupported(params)) {
        return toBtcSwap(params)
    }

    if (isToSolanaSwapSupported(params)) {
        return toSolanaSwap(params)
    }

    if (isBridgeSupported(params)) {
        return bridge(params)
    }

    if (isTonChainId(tokenOut.chainId)) {
        return toTonSwap(params)
    }

    return crosschainSwap(params)
}

import { isTronChainId, tronAddressToEvm } from '../tron'
import { bridge, isBridgeSupported } from './bridge'
import { crosschainSwap } from './crosschainSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { onchainSwap } from './onchainSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'
import { toTonSwap } from './toTonSwap'
import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap'
import { fromBtcSwap, isFromBtcSwapSupported } from './fromBtcSwap'
import { isTonChainId } from '../utils'

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

    if (isFeeCollectorSwapSupported(params)) {
        return feeCollectorSwap(params)
    }

    if (tokenAmountIn.token.chainId === tokenOut.chainId) {
        return onchainSwap(params)
    }

    if (isFromBtcSwapSupported(params)) {
        return fromBtcSwap(params)
    }

    if (isToBtcSwapSupported(params)) {
        return toBtcSwap(params)
    }

    if (isBridgeSupported(params)) {
        return bridge(params)
    }

    if (isTonChainId(tokenOut.chainId)) {
        return toTonSwap(params)
    }

    return crosschainSwap(params)
}

import { isTonChainId, isTronChainId, tronAddressToEvm } from '../chainUtils/index.ts'
import { bridge, isBridgeSupported } from './bridge.ts'
import { crosschainSwap } from './crosschainSwap/index.ts'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap.ts'
import { isOnchainSwapSupported, onchainSwap } from './onchainSwap.ts'
import { SwapExactInParams, SwapExactInResult } from '../types.ts'
import { isUnwrapSupported, unwrap } from './unwrap.ts'
import { isWrapSupported, wrap } from './wrap.ts'
import { toTonSwap } from './toTonSwap.ts'
import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap.ts'
import { isFromBtcSwapSupported, fromBtcSwap } from './fromBtcSwap.ts'
import { isToSolanaSwapSupported, toSolanaSwap } from './toSolanaSwap.ts'

export * from './fromBtcSwap.ts'

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

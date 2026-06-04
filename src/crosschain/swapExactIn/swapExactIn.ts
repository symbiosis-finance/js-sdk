import { isTonChainId, isTronChainId, tronAddressToEvm } from '../chainUtils'
import { UnsupportedPairError } from '../sdkError'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { bridge, isBridgeSupported } from './bridge'
import { changellyNativeSwap, isChangellyNativeSupported } from './changellySwap'
import { crossChainSwap } from './crossChainSwap'
import { intentSwap, isIntentSwapSupported } from './intentSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { fromBtcSwap, isFromBtcSwapSupported } from './fromBtcSwap'
import { isOnchainSwapSupported, onchainSwap } from './onchainSwap'
import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap'
import { isToSolanaSwapSupported, toSolanaSwap } from './toSolanaSwap'
import { fromSolanaSwap, isFromSolanaSwapSupported } from './fromSolanaSwap'
import { toTonSwap } from './toTonSwap'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'
import { ChainId } from '../../constants'

export * from './fromBtcSwap'

// Universal stateless function that allows swap tokens on the same chain or cross-chain
export function swapExactIn(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    const { tokenAmountIn, tokenOut } = params

    if (tokenAmountIn.token.equals(tokenOut)) {
        throw new UnsupportedPairError('Cannot swap same tokens')
    }

    if (isTronChainId(tokenAmountIn.token.chainId)) {
        params.from = tronAddressToEvm(params.from)
    }
    if (isTronChainId(tokenOut.chainId)) {
        params.to = tronAddressToEvm(params.to)
    }
    if (!params.origin) {
        params.origin = params.from
    }

    if (isChangellyNativeSupported(params)) {
        return [changellyNativeSwap(params)]
    }

    if (isWrapSupported(params)) {
        return [wrap(params)]
    }

    if (isUnwrapSupported(params)) {
        return [unwrap(params)]
    }

    if (isOnchainSwapSupported(params)) {
        if (isFeeCollectorSwapSupported(params)) {
            return feeCollectorSwap(params)
        }

        return onchainSwap(params)
    }

    if (isBridgeSupported(params)) {
        return [bridge(params)]
    }

    if (isIntentSwapSupported(params)) {
        return [intentSwap(params)]
    }

    // FROM flow
    if (isFromBtcSwapSupported(params)) {
        return fromBtcSwap(params)
    }

    if (isFromSolanaSwapSupported(params)) {
        return fromSolanaSwap(params)
    }

    // TO flow
    if (isToBtcSwapSupported(params)) {
        return toBtcSwap(params)
    }

    if (isToSolanaSwapSupported(params)) {
        return toSolanaSwap(params)
    }

    if (isTonChainId(tokenOut.chainId)) {
        return toTonSwap(params)
    }

    // disable depository for Ethereum chain
    const depositoryEnabled = tokenOut.chainId !== ChainId.ETH_MAINNET
    return crossChainSwap({ ...params, depositoryEnabled })
}

import { isTronChainId, tronAddressToEvm } from '../tron'
import { bridge, isBridgeSupported } from './bridge'
import { crosschainSwap } from './crosschainSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { onchainSwap } from './onchainSwap'
import { SwapExactInParams, SwapExactInResult } from './types'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'
// import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap'
import { fromBtcSwap, isFromBtcSwapSupported } from './fromBtcSwap'

// Universal stateless function that allows swap tokens on same chain or crosschain
export async function swapExactIn(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken } = params

    if (isTronChainId(inTokenAmount.token.chainId)) {
        params.fromAddress = tronAddressToEvm(params.fromAddress)
    }
    if (isTronChainId(outToken.chainId)) {
        params.toAddress = tronAddressToEvm(params.toAddress)
    }

    if (inTokenAmount.token.equals(outToken)) {
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

    if (inTokenAmount.token.chainId === outToken.chainId) {
        return onchainSwap(params)
    }

    if (isFromBtcSwapSupported(params)) {
        return fromBtcSwap(params)
    }

    // if (isToBtcSwapSupported(params)) {
    //     return toBtcSwap(params)
    // }

    if (isBridgeSupported(params)) {
        return bridge(params)
    }

    return crosschainSwap(params)
}

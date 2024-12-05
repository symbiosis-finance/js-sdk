import { isTonChainId, isTronChainId, tronAddressToEvm } from '../chainUtils'
import { bridge, isBridgeSupported } from './bridge'
import { crosschainSwap } from './crosschainSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { isOnchainSwapSupported, onchainSwap } from './onchainSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'
import { toTonSwap } from './toTonSwap'
import { isToBtcSwapSupported, toBtcSwap } from './toBtcSwap'
import { fromBtcSwap, isFromBtcSwapSupported } from './fromBtcSwap'
import { Token } from '../../entities'
import { ChainId } from '../../constants'

const syBTC = new Token({
    name: 'Symbiosis BTC',
    symbol: 'syBTC',
    address: '0xED0c95EBe5a3E687cB2224687024FeC6518E683e',
    chainId: ChainId.ZKSYNC_MAINNET,
    decimals: 8,
})

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
        if (tokenAmountIn.token.equals(syBTC) || tokenOut.equals(syBTC)) {
            return crosschainSwap(params)
        }

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

    if (isBridgeSupported(params)) {
        return bridge(params)
    }

    if (isTonChainId(tokenOut.chainId)) {
        return toTonSwap(params)
    }

    return crosschainSwap(params)
}

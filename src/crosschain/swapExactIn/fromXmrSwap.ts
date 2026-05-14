import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { changellyNativeSwap } from './changellySwap'

export function isFromXmrSupported(context: SwapExactInParams): boolean {
    return context.tokenAmountIn.token.chainId === ChainId.XMR_MAINNET
}

export function fromXmrSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    if (params.refundAddress) {
        validateDepositAddress(ChainId.XMR_MAINNET, params.refundAddress)
    }
    return [changellyNativeSwap(params)]
}

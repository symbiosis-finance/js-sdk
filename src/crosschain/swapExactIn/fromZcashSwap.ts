import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { changellyNativeSwap } from './changellySwap'

export function isFromZcashSupported(context: SwapExactInParams): boolean {
    return context.tokenAmountIn.token.chainId === ChainId.ZCASH_MAINNET
}

export function fromZcashSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    if (params.refundAddress) {
        validateDepositAddress(ChainId.ZCASH_MAINNET, params.refundAddress)
    }
    return [changellyNativeSwap(params)]
}

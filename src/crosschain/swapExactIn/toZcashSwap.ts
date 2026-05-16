import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { changellyNativeSwap } from './changellySwap'

export function isToZcashSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.ZCASH_MAINNET
}

export function toZcashSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.ZCASH_MAINNET, params.to)
    return [changellyNativeSwap(params)]
}

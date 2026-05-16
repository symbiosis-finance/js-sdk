import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { changellyNativeSwap } from './changellySwap'

export function isToXmrSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.XMR_MAINNET
}

export function toXmrSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.XMR_MAINNET, params.to)
    return [changellyNativeSwap(params)]
}

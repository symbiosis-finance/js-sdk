import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { thorChainSwap } from './thorChainSwap'

export function isToLtcSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.LTC_MAINNET
}

export function toLtcSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.LTC_MAINNET, params.to)
    return thorChainSwap(params)
}

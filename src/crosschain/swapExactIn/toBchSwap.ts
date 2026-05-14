import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { thorChainSwap } from './thorChainSwap'

export function isToBchSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.BCH_MAINNET
}

export function toBchSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.BCH_MAINNET, params.to)
    return thorChainSwap(params)
}

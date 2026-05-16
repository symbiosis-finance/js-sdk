import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { thorChainSwap } from './thorChainSwap'

export function isToXrpSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.XRP_MAINNET
}

export function toXrpSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.XRP_MAINNET, params.to)
    return thorChainSwap(params)
}

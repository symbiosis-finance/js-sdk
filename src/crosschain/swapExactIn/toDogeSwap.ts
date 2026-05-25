import { ChainId } from '../../constants'
import type { SwapExactInParams, SwapExactInResult } from '../types'
import { validateDepositAddress } from './addressValidation'
import { thorChainSwap } from './thorChainSwap'

export function isToDogeSupported(context: SwapExactInParams): boolean {
    return context.tokenOut.chainId === ChainId.DOGE_MAINNET
}

export function toDogeSwap(params: SwapExactInParams): Promise<SwapExactInResult>[] {
    validateDepositAddress(ChainId.DOGE_MAINNET, params.to)
    return thorChainSwap(params)
}

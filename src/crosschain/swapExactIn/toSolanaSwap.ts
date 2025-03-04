import { SwapExactInParams, SwapExactInResult } from '../types'
import { ChainId } from '../../constants'
import { theBest } from './utils'
import { isSolanaChainId } from '../chainUtils/solana'
import { solanaChainFlipSwap } from './swapChainFlip'

function isChainFlipAvailable(chainId: ChainId) {
    return isSolanaChainId(chainId)
}

export function isToSolanaSwapSupported(context: SwapExactInParams): boolean {
    const { tokenOut } = context

    return isChainFlipAvailable(tokenOut.chainId)
}

export async function toSolanaSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenOut, selectMode } = context

    const promises = []
    if (isChainFlipAvailable(tokenOut.chainId)) {
        promises.push(solanaChainFlipSwap(context))
    }

    return theBest(promises, selectMode)
}

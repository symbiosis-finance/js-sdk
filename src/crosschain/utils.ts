import { ChainId } from '../constants'
import { Token } from '../entities'

export function isUseOneInchOnly(tokenIn: Token, tokenOut: Token): boolean {
    return [tokenIn.chainId, tokenOut.chainId].some((i) => i === ChainId.TRON_MAINNET)
}

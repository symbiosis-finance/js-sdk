import { ChainId } from '../constants.ts'
import { Token } from '../entities/index.ts'

export function isUseOneInchOnly(tokenIn: Token, tokenOut: Token): boolean {
    return [tokenIn.chainId, tokenOut.chainId].some((i) => i === ChainId.TRON_MAINNET)
}

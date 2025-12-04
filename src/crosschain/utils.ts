import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'

interface TokensInAndOut {
    tokenAmountIn: TokenAmount
    tokenOut: Token
}

export function isUseOneInchOnly(context: TokensInAndOut): boolean {
    return [context.tokenAmountIn.token.chainId, context.tokenOut.chainId].some((i) => i === ChainId.TRON_MAINNET)
}

import { Token as TokenUni, CurrencyAmount, Currency } from '@uniswap/sdk-core'
import { Token, TokenAmount } from '../../../entities'

export function toUniToken(token: Token): TokenUni {
    return new TokenUni(token.chainId, token.address, token.decimals)
}

export function toUniTokenAmount(tokenAmount: TokenAmount): CurrencyAmount<Currency> {
    const token = toUniToken(tokenAmount.token)
    return CurrencyAmount.fromRawAmount(token, tokenAmount.raw.toString())
}

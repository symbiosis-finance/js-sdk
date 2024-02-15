import { Token as TokenUni, CurrencyAmount, Currency } from '@uniswap/sdk-core'
import { Token, TokenAmount } from '../../../entities'
import { RBTC } from './wrbtc'

export function toUniToken(token: Token): TokenUni {
    return new TokenUni(token.chainId, token.address, token.decimals)
}

export function toUniCurrency(token: Token): Currency {
    if (token.isNative) {
        return RBTC.onChain(token.chainId)
    }
    return toUniToken(token)
}

export function toUniTokenAmount(tokenAmount: TokenAmount): CurrencyAmount<Currency> {
    const token = toUniToken(tokenAmount.token)
    return CurrencyAmount.fromRawAmount(token, tokenAmount.raw.toString())
}

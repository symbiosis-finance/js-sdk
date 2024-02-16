import { Token as TokenUni, CurrencyAmount, Currency } from '@uniswap/sdk-core'
import { Token, TokenAmount } from '../../../entities'
import { GasToken } from './gasToken'

export function toUniToken(token: Token): TokenUni {
    return new TokenUni(token.chainId, token.address, token.decimals)
}

export function toUniCurrency(token: Token): Currency {
    if (token.isNative) {
        return GasToken.onChain(token.chainId)
    }
    return toUniToken(token)
}

export function toUniCurrencyAmount(tokenAmount: TokenAmount): CurrencyAmount<Currency> {
    const currency = toUniCurrency(tokenAmount.token)
    return CurrencyAmount.fromRawAmount(currency, tokenAmount.raw.toString())
}

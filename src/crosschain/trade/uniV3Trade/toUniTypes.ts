import type { Currency, Ether } from '@uniswap/sdk-core'
import { CurrencyAmount, NativeCurrency, Token as TokenUni } from '@uniswap/sdk-core'
import invariant from 'tiny-invariant'

import type { ChainId } from '../../../constants'
import type { Token, TokenAmount } from '../../../entities'
import { WETH } from '../../../entities'

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

export class GasToken extends NativeCurrency {
    protected constructor(chainId: number) {
        super(chainId, 18, 'GAS', 'GAS')
    }

    public get wrapped(): TokenUni {
        const weth9 = WETH[this.chainId as ChainId]
        invariant(!!weth9, 'WRAPPED')
        return toUniToken(weth9)
    }

    private static _cache: { [chainId: number]: Ether } = {}

    public static onChain(chainId: number): GasToken {
        return this._cache[chainId] ?? (this._cache[chainId] = new GasToken(chainId))
    }

    public equals(other: Currency): boolean {
        return other.isNative && other.chainId === this.chainId
    }
}

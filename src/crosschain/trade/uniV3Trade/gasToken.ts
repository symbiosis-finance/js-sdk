import { Currency, Ether, Token, NativeCurrency } from '@uniswap/sdk-core'
import { ChainId } from '../../../constants'
import { WETH } from '../../../entities'
import invariant from 'tiny-invariant'
import { toUniToken } from './toUniTypes'

export class GasToken extends NativeCurrency {
    protected constructor(chainId: number) {
        super(chainId, 18, 'RBTC', 'RBTC')
    }

    public get wrapped(): Token {
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

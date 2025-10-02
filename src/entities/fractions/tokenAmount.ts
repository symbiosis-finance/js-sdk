import invariant from 'tiny-invariant'
import JSBI from 'jsbi'

import { BigintIsh, Rounding, SolidityType, TEN } from '../../constants'
import { parseBigintIsh, validateSolidityTypeInstance } from '../../utils'
import { Token } from '../../entities'
import { Fraction } from './fraction'
import Decimal from 'decimal.js-light'

export class TokenAmount extends Fraction {
    public readonly token: Token

    public constructor(token: Token, amount: BigintIsh) {
        const parsedAmount = parseBigintIsh(amount)
        validateSolidityTypeInstance(parsedAmount, SolidityType.uint256)

        super(parsedAmount, JSBI.exponentiate(TEN, JSBI.BigInt(token.decimals)))
        this.token = token
    }

    public get raw(): JSBI {
        return this.numerator
    }

    public add(other: TokenAmount): TokenAmount {
        invariant(this.token.equals(other.token), 'TOKEN')
        return new TokenAmount(this.token, JSBI.add(this.raw, other.raw))
    }

    public subtract(other: TokenAmount): TokenAmount {
        invariant(this.token.equals(other.token), 'TOKEN')
        return new TokenAmount(this.token, JSBI.subtract(this.raw, other.raw))
    }

    public greaterThanOrEqual(amount: JSBI): boolean {
        return JSBI.greaterThanOrEqual(this.raw, amount)
    }

    public toSignificant(significantDigits = 6, format?: object, rounding: Rounding = Rounding.ROUND_DOWN): string {
        return super.toSignificant(significantDigits, format, rounding)
    }

    public toFixed(
        decimalPlaces: number = this.token.decimals,
        format?: object,
        rounding: Rounding = Rounding.ROUND_DOWN
    ): string {
        invariant(decimalPlaces <= this.token.decimals, 'DECIMALS')
        return super.toFixed(decimalPlaces, format, rounding)
    }

    public toExact(decimalPlaces: number = this.token.decimals, format: object = { groupSeparator: '' }): string {
        return super.toExact(decimalPlaces, format)
    }

    public toBigInt(): bigint {
        return BigInt(this.raw.toString())
    }

    public convertTo(other: Token, price: number): TokenAmount {
        const dec = new Decimal(10).pow(other.decimals)
        const thisD = this.toDecimal()
        return new TokenAmount(other, BigInt(thisD.mul(price).mul(dec).toString()))
    }
}

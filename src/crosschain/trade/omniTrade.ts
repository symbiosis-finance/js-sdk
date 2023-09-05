import { Fraction, Percent, Token, TokenAmount } from '../../entities'
import { OmniPool, OmniPoolOracle } from '../contracts'
import { basisPointsToPercent, calculatePriceImpact } from '../utils'
import { ONE } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { OmniPoolConfig } from '../types'
import { BigNumber } from 'ethers'
import { Error, ErrorCode } from '../error'
import { DataProvider } from '../dataProvider'

export class OmniTrade {
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent

    public readonly pool: OmniPool
    public readonly poolOracle: OmniPoolOracle

    public constructor(
        public readonly tokenAmountIn: TokenAmount,
        private readonly tokenOut: Token,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly symbiosis: Symbiosis,
        private readonly to: string,
        private readonly omniPoolConfig: OmniPoolConfig,
        private readonly dataProvider: DataProvider
    ) {
        this.pool = this.symbiosis.omniPool(omniPoolConfig)
        this.poolOracle = this.symbiosis.omniPoolOracle(omniPoolConfig)
    }

    private async validateCashReserves(tokenAmount: TokenAmount, indexOut: number) {
        const assetOut = await this.dataProvider.indexToAsset(this.pool, indexOut)
        const percent = 70
        const threshold = assetOut.cash.mul(percent).div(100)

        const delimiter = BigNumber.from(10).pow(tokenAmount.token.decimals)
        const multiplier = BigNumber.from(10).pow(18)
        const amount = BigNumber.from(tokenAmount.raw.toString()).mul(multiplier).div(delimiter)

        if (threshold.lt(amount)) {
            throw new Error(`Amount is too high`, ErrorCode.AMOUNT_TOO_HIGH)
        }
    }

    public async init() {
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        const indexIn = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenAmountIn.token)
        const indexOut = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenOut)

        await this.validateCashReserves(this.tokenAmountIn, indexOut)

        const quoteFrom = await this.poolOracle.quoteFrom(indexIn, indexOut, this.tokenAmountIn.raw.toString())

        this.amountOut = new TokenAmount(this.tokenOut, quoteFrom.actualToAmount.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const slippageAdjustedAmountOut = new Fraction(ONE)
            .add(slippageTolerance)
            .invert()
            .multiply(this.amountOut.raw).quotient

        this.callData = this.pool.interface.encodeFunctionData('swap', [
            indexIn,
            indexOut,
            this.tokenAmountIn.raw.toString(),
            slippageAdjustedAmountOut.toString(),
            this.to,
            this.deadline,
        ])

        const priceImpact = calculatePriceImpact(this.tokenAmountIn, this.amountOut)
        if (!priceImpact) {
            throw new Error('Cannot calculate priceImpact')
        }
        this.priceImpact = priceImpact

        return this
    }
}

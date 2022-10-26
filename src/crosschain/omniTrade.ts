import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { OmniPool } from './contracts'
import { basisPointsToPercent, calculatePriceImpact } from './utils'
import { ONE } from '../constants'
import { Symbiosis } from './symbiosis'

export class OmniTrade {
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent

    public readonly pool: OmniPool

    public constructor(
        public readonly tokenAmountIn: TokenAmount,
        private readonly tokenOut: Token,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly symbiosis: Symbiosis,
        private readonly to: string
    ) {
        this.pool = this.symbiosis.omniPool()
    }

    public async init() {
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        const indexIn = await this.pool.assetToIndex(this.tokenAmountIn.token.address)
        const indexOut = await this.pool.assetToIndex(this.tokenOut.address)

        const [amountOut, _] = await this.pool.callStatic.swap(
            indexIn,
            indexOut,
            this.tokenAmountIn.raw.toString(),
            0,
            this.to,
            this.deadline,
            {
                from: '0xd1d950F53e78BB9f434c07F16218f8149f7CE542', // FIXME use specific method to calculate swap
            }
        )

        this.amountOut = new TokenAmount(this.tokenOut, amountOut.toString())

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

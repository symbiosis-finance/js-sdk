import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { NervePool } from './contracts'
import { basisPointsToPercent, calculatePriceImpact } from './utils'
import { ONE } from '../constants'

export class NerveTrade {
    public tokenAmountIn: TokenAmount
    public pool: NervePool

    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent

    private readonly tokenOut: Token
    private readonly deadline!: number
    private readonly slippage!: number

    public constructor(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        slippage: number,
        deadline: number,
        pool: NervePool
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.deadline = deadline
        this.slippage = slippage
        this.pool = pool
    }

    public async init() {
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        const indexTokenIn = await this.pool.getTokenIndex(this.tokenAmountIn.token.address)
        const indexTokenOut = await this.pool.getTokenIndex(this.tokenOut.address)
        const amountOut = await this.pool.calculateSwap(indexTokenIn, indexTokenOut, this.tokenAmountIn.raw.toString())
        this.amountOut = new TokenAmount(this.tokenOut, amountOut.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const slippageAdjustedAmountOut = new Fraction(ONE)
            .add(slippageTolerance)
            .invert()
            .multiply(this.amountOut.raw).quotient

        this.callData = this.pool.interface.encodeFunctionData('swap', [
            indexTokenIn,
            indexTokenOut,
            this.tokenAmountIn.raw.toString(),
            slippageAdjustedAmountOut.toString(),
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

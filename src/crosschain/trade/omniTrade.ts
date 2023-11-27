import { Percent, Token, TokenAmount } from '../../entities'
import { OmniPool, OmniPoolOracle } from '../contracts'
import { calculatePriceImpact, getMinAmount } from '../utils'
import { Symbiosis } from '../symbiosis'
import { OmniPoolConfig } from '../types'

export class OmniTrade {
    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public priceImpact!: Percent

    public readonly pool: OmniPool
    public readonly poolOracle: OmniPoolOracle

    public constructor(
        public readonly tokenAmountIn: TokenAmount,
        public readonly tokenAmountInMin: TokenAmount,
        private readonly tokenOut: Token,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly symbiosis: Symbiosis,
        private readonly to: string,
        private readonly omniPoolConfig: OmniPoolConfig
    ) {
        this.pool = this.symbiosis.omniPool(omniPoolConfig)
        this.poolOracle = this.symbiosis.omniPoolOracle(omniPoolConfig)
    }

    public async init() {
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        const indexIn = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenAmountIn.token)
        const indexOut = this.symbiosis.getOmniPoolTokenIndex(this.omniPoolConfig, this.tokenOut)

        const quote = await this.poolOracle.quoteFrom(indexIn, indexOut, this.tokenAmountIn.raw.toString())

        let quoteMin = quote
        if (!this.tokenAmountIn.equalTo(this.tokenAmountInMin)) {
            quoteMin = await this.poolOracle.quoteFrom(indexIn, indexOut, this.tokenAmountInMin.raw.toString())
        }

        this.amountOut = new TokenAmount(this.tokenOut, quote.actualToAmount.toString())

        const amountOutMinRaw = getMinAmount(this.slippage, quoteMin.actualToAmount.toString())
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.callData = this.pool.interface.encodeFunctionData('swap', [
            indexIn,
            indexOut,
            this.tokenAmountIn.raw.toString(),
            amountOutMinRaw.toString(),
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

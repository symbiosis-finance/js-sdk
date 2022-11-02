import { ONE } from '../constants'
import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { basisPointsToPercent } from './utils'
import { OmniPool, OmniPoolOracle } from './contracts'

export class OmniLiquidity {
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public callDataOffset = 4 + 32 * 2

    public constructor(
        private readonly tokenAmountIn: TokenAmount,
        private readonly to: string,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly pool: OmniPool,
        private readonly poolOracle: OmniPoolOracle
    ) {}

    public async init() {
        const network = await this.pool.provider.getNetwork()

        const index = await this.pool.assetToIndex(this.tokenAmountIn.token.address)

        const depositEstimate = await this.poolOracle.quoteDeposit(index, this.tokenAmountIn.raw.toString())

        const lpToken = new Token({
            address: this.pool.address,
            decimals: 18,
            chainId: network.chainId,
        })
        this.amountOut = new TokenAmount(lpToken, depositEstimate.lpTokenToMint.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const slippageAdjustedAmountOut = new Fraction(ONE)
            .add(slippageTolerance)
            .invert()
            .multiply(this.amountOut.raw).quotient

        this.callData = this.pool.interface.encodeFunctionData('deposit', [
            index,
            this.tokenAmountIn.raw.toString(),
            slippageAdjustedAmountOut.toString(),
            this.to,
            this.deadline,
        ])

        return this
    }
}

import { ONE } from '../constants'
import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { basisPointsToPercent } from './utils'
import { OmniPool } from './contracts'

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
        private readonly from: string
    ) {}

    public async init() {
        const network = await this.pool.provider.getNetwork()

        const index = await this.pool.assetToIndex(this.tokenAmountIn.token.address)

        console.log({ tokenAmountIn: this.tokenAmountIn, index })
        const depositEstimate = await this.pool.callStatic.deposit(
            index,
            this.tokenAmountIn.raw.toString(),
            '0',
            this.to,
            this.deadline,
            {
                from: this.from,
            }
        )

        console.log({ index, depositEstimate: depositEstimate.liquidity.toString() })
        const erc1155Token = new Token({
            address: this.pool.address,
            decimals: 18,
            chainId: network.chainId,
        })
        this.amountOut = new TokenAmount(erc1155Token, depositEstimate.liquidity.toString())

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

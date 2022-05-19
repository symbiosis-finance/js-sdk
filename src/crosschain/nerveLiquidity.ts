import { ONE } from '../constants'
import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { NervePool } from './contracts'
import { basisPointsToPercent } from './utils'

export class NerveLiquidity {
    public tokenAmountIn: TokenAmount
    public pool: NervePool
    public poolLpToken!: Token

    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public callDataOffset = 4 + 32 * 6

    private readonly to: string
    private readonly deadline!: number
    private readonly slippage!: number

    public constructor(tokenAmountIn: TokenAmount, to: string, slippage: number, deadline: number, pool: NervePool) {
        this.tokenAmountIn = tokenAmountIn
        this.to = to
        this.deadline = deadline
        this.slippage = slippage
        this.pool = pool
    }

    public async init() {
        const network = await this.pool.provider.getNetwork()
        const storage = await this.pool.swapStorage()
        const lpTokenAmount = await this.pool.calculateTokenAmount(
            this.to,
            ['0', this.tokenAmountIn.raw.toString()],
            true
        )

        this.poolLpToken = new Token({
            address: storage.lpToken,
            decimals: 18,
            chainId: network.chainId,
        })
        this.amountOut = new TokenAmount(this.poolLpToken, lpTokenAmount.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const slippageAdjustedAmountOut = new Fraction(ONE)
            .add(slippageTolerance)
            .invert()
            .multiply(this.amountOut.raw).quotient

        this.callData = this.pool.interface.encodeFunctionData('addLiquidity', [
            ['0', this.tokenAmountIn.raw.toString()],
            slippageAdjustedAmountOut.toString(),
            this.deadline,
        ])

        return this
    }
}

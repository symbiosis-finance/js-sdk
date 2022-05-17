import { ChainId, ONE } from '../constants'
import { Fraction, Percent, Token, TokenAmount } from '../entities'
import { NervePool } from './contracts'
import { basisPointsToPercent } from './utils'

export class NerveLiquidity {
    public tokenAmountIn: TokenAmount
    public pool: NervePool
    public chainId: ChainId

    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public callDataOffset = 4 + 32 * 6

    private readonly to: string
    private readonly deadline!: number
    private readonly slippage!: number

    public constructor(
        tokenAmountIn: TokenAmount,
        to: string,
        slippage: number,
        deadline: number,
        pool: NervePool,
        chainId: ChainId
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.to = to
        this.deadline = deadline
        this.slippage = slippage
        this.pool = pool
        this.chainId = chainId
    }

    public async init() {
        const storage = await this.pool.swapStorage()
        const lpTokenAmount = await this.pool.calculateTokenAmount(
            this.to,
            ['0', this.tokenAmountIn.raw.toString()],
            true
        )

        const token = new Token({
            address: storage.lpToken,
            decimals: 18,
            chainId: this.chainId,
        })
        this.amountOut = new TokenAmount(token, lpTokenAmount.toString())

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

import type { Address } from '.'
import type { Percent } from '../entities'
import { Token, TokenAmount } from '../entities'
import { getMinAmount } from './chainUtils'
import type { OmniPool, OmniPoolOracle } from './contracts'

export class OmniLiquidity {
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public callDataOffset = 4 + 32 * 2

    public constructor(
        public readonly tokenAmountIn: TokenAmount,
        private readonly to: string,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly pool: OmniPool,
        private readonly poolOracle: OmniPoolOracle
    ) {}

    public async init() {
        const network = await this.pool.provider.getNetwork()

        const index = await this.pool.assetToIndex(this.tokenAmountIn.token.address)

        const depositEstimate = await this.poolOracle.callStatic.quoteDeposit(index, this.tokenAmountIn.raw.toString())

        const lpToken = new Token({
            address: this.pool.address as Address,
            decimals: 18,
            chainId: network.chainId,
        })
        this.amountOut = new TokenAmount(lpToken, depositEstimate.lpTokenToMint.toString())
        const slippageAdjustedAmountOut = getMinAmount(this.slippage, this.amountOut.raw)

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

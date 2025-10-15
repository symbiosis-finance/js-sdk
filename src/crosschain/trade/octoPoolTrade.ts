import { TokenAmount } from '../../entities/index.ts'
import { OmniPool__factory } from '../contracts/index.ts'
import { calculatePriceImpact, getMinAmount } from '../chainUtils/index.ts'
import { Symbiosis } from '../symbiosis.ts'
import { OmniPoolConfig } from '../types.ts'
import { BigNumber } from 'ethers'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade.ts'

interface OctoPoolTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    tokenAmountInMin: TokenAmount
    deadline: number
    omniPoolConfig: OmniPoolConfig
}

export class OctoPoolTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    public readonly tokenAmountInMin: TokenAmount
    public readonly deadline: number
    public readonly poolConfig: OmniPoolConfig

    public constructor(params: OctoPoolTradeParams) {
        super(params)

        const { symbiosis, omniPoolConfig, tokenAmountInMin, deadline } = params
        this.symbiosis = symbiosis
        this.tokenAmountInMin = tokenAmountInMin
        this.deadline = deadline
        this.poolConfig = omniPoolConfig
    }

    get tradeType(): SymbiosisTradeType {
        return 'octopool'
    }

    public async init() {
        const indexIn = this.symbiosis.getOmniPoolTokenIndex(this.poolConfig, this.tokenAmountIn.token)
        const indexOut = this.symbiosis.getOmniPoolTokenIndex(this.poolConfig, this.tokenOut)

        const amountIn = BigNumber.from(this.tokenAmountIn.raw.toString())
        const amountInMin = BigNumber.from(this.tokenAmountInMin.raw.toString())

        const quote = await this.quote(indexIn, indexOut, amountIn)

        let quoteMin = quote
        if (amountInMin.lt(amountIn)) {
            quoteMin = quote.mul(amountInMin).div(amountIn) // proportionally
        }

        quoteMin = BigNumber.from(getMinAmount(this.slippage, quoteMin.toString()).toString())

        const callData = OmniPool__factory.createInterface().encodeFunctionData('swap', [
            indexIn,
            indexOut,
            amountIn.toString(),
            quoteMin.toString(),
            this.to,
            this.deadline,
        ])

        const amountOut = new TokenAmount(this.tokenOut, quote.toString())
        const amountOutMin = new TokenAmount(this.tokenOut, quoteMin.toString())
        const priceImpact = calculatePriceImpact(this.tokenAmountIn, amountOut)

        this.symbiosis.trackPriceImpactSwap({
            name_from: `${this.tokenAmountIn.token.symbol}(${
                (this.tokenAmountIn.token.chainFrom || this.tokenAmountIn.token.chain)?.name
            })`,
            name_to: `${this.tokenOut.symbol}(${(this.tokenOut.chainFrom || this.tokenOut.chain)?.name})`,
            token_amount: Number(this.tokenAmountIn.toSignificant(4)),
            price_impact: Math.abs(+priceImpact.toSignificant(2)),
        })

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: this.poolConfig.address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset: 100,
            minReceivedOffset: 132,
            priceImpact,
        }

        return this
    }

    public async quote(indexIn: number, indexOut: number, amountIn: BigNumber): Promise<BigNumber> {
        const poolOracle = this.symbiosis.omniPoolOracle(this.poolConfig)
        const { actualToAmount } = await poolOracle.quoteFrom(indexIn, indexOut, amountIn)
        return actualToAmount
    }
}

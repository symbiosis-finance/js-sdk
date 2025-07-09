import { TokenAmount } from '../../entities'
import { OmniPool__factory } from '../contracts'
import { calculatePriceImpact, getMinAmount } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { OmniPoolConfig } from '../types'
import { BigNumber } from 'ethers'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { GAS_UNITS_OPERATIONS, SwapOperation } from '../constants'

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

    public get gasUnits(): number {
        return GAS_UNITS_OPERATIONS[SwapOperation.OCTO_POOL_SWAP]
    }

    public async quote(indexIn: number, indexOut: number, amountIn: BigNumber): Promise<BigNumber> {
        const poolOracle = this.symbiosis.omniPoolOracle(this.poolConfig)
        const { actualToAmount } = await poolOracle.quoteFrom(indexIn, indexOut, amountIn)
        return actualToAmount
    }
}

import { BigNumber } from 'ethers'

import { TokenAmount } from '../../entities'
import { calculatePriceImpact, getMinAmount } from '../chainUtils'
import { OmniPool__factory } from '../contracts'
import type { Symbiosis } from '../symbiosis'
import type { OmniPoolConfig } from '../types'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

interface OctoPoolTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
    poolConfig: OmniPoolConfig
}

export class OctoPoolTrade extends SymbiosisTrade implements OctoPoolTradeParams {
    public readonly symbiosis: Symbiosis
    public readonly deadline: number
    public readonly poolConfig: OmniPoolConfig

    public constructor(params: OctoPoolTradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.deadline = params.deadline
        this.poolConfig = params.poolConfig
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
            poolConfig: this.poolConfig,
            tokenAmountFrom: this.tokenAmountIn,
            tokenTo: this.tokenOut,
            priceImpact,
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

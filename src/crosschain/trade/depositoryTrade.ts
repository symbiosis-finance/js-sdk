import { TokenAmount } from '../../entities'
import { DepositParameters, DepositoryContext } from '../depository'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

export class DepositoryTrade extends SymbiosisTrade {
    constructor(
        params: SymbiosisTradeParams,
        private dep: DepositoryContext,
        private depositParams: DepositParameters,
        private baseTrade?: SymbiosisTrade
    ) {
        super(params)
    }

    async init(): Promise<this> {
        this.out = await this.dep.buildDepositCall(this.depositParams)
        return this
    }

    get tradeType(): SymbiosisTradeType {
        return 'depository'
    }

    async applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount): Promise<void> {
        if (this.baseTrade) {
            // If we have a base trade - then just reinit itself.
            await this.baseTrade.applyAmountIn(newAmountIn, newAmountInMin)
            await this.init()
        } else {
            await super.applyAmountIn(newAmountIn, newAmountInMin)
        }
    }
}

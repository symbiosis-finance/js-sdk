import type { TokenAmount } from '../../entities'
import type { DepositoryContext, DepositParams } from '../depository'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

export class DepositoryTrade extends SymbiosisTrade {
    constructor(
        params: SymbiosisTradeParams,
        private dep: DepositoryContext,
        private depositParams: DepositParams,
        private baseTrade?: SymbiosisTrade
    ) {
        super(params)
    }

    async init(): Promise<this> {
        this.buildDepositCall(this.depositParams)
        return this
    }

    get tradeType(): SymbiosisTradeType {
        return 'depository'
    }

    applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount): void {
        if (this.baseTrade) {
            // If we have a base trade - then just reinit itself.
            this.baseTrade.applyAmountIn(newAmountIn, newAmountInMin)

            // overwrite depositParams with a new amountIn after patching
            const { tokenAmountIn } = this.baseTrade
            this.buildDepositCall({
                ...this.depositParams,
                tokenAmountIn,
            })
        } else {
            super.applyAmountIn(newAmountIn, newAmountInMin)
        }
    }

    private buildDepositCall(params: DepositParams) {
        this.out = this.dep.buildDepositCall(params)
    }
}

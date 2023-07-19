import { BaseSwapping, SwapExactIn, SwapExactInParams } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(params: SwapExactInParams): SwapExactIn {
        return this.doExactIn(params)
    }
}

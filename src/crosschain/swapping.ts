import { BaseSwapping, SwapExactIn, SwapExactInParams } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(params: SwapExactInParams): Promise<SwapExactIn> {
        return this.doExactIn(params)
    }
}

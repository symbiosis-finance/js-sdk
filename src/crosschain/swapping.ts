import { CrosschainSwapExactInResult, SwapExactInParams } from './baseSwappingImplementation'
import { BaseSwapping } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(params: SwapExactInParams): Promise<CrosschainSwapExactInResult> {
        return this.doExactIn(params)
    }
}

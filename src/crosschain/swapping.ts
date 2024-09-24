import { BaseSwapping } from './baseSwapping'
import { SwapExactInParams, SwapExactInResult } from './types'

export class Swapping extends BaseSwapping {
    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }
}

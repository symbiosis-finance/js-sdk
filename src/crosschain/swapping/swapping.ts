import { BaseSwapping } from './baseSwapping.ts'
import { SwapExactInParams, SwapExactInResult } from '../types.ts'

export class Swapping extends BaseSwapping {
    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }
}

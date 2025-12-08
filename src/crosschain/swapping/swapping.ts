import type { SwapExactInParams, SwapExactInResult } from '../types'
import { BaseSwapping } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }
}

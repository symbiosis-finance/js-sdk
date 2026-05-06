import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { withTracing } from '../../tracing'
import { BaseSwapping } from './baseSwapping'

export class Swapping extends BaseSwapping {
    @withTracing()
    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }
}

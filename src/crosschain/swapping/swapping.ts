import type { SwapExactInParams, SwapExactInResult } from '../types'
import { BaseSwapping } from './baseSwapping'
import { withTracing } from '../tracing'

export class Swapping extends BaseSwapping {
    @withTracing({
        onCall: function (_) {
            return {
                'omniPool.chainId': this.omniPoolConfig.chainId,
                'omniPool.address': this.omniPoolConfig.address,
            }
        },
    })
    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return this.doExactIn(params)
    }
}

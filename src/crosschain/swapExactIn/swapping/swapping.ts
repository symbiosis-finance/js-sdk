import type { Token } from '../../../entities'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { withTracing } from '../../tracing'
import { BaseSwapping } from './baseSwapping'

export class Swapping extends BaseSwapping {
    @withTracing()
    public async exactIn(
        params: Omit<SwapExactInParams, 'symbiosis'>,
        transitTokenIn?: Token,
        transitTokenOut?: Token
    ): Promise<SwapExactInResult> {
        return this.doExactIn(params, transitTokenIn, transitTokenOut)
    }
}

import { BaseSwapping, BaseSwappingExactInResult, BaseSwappingExactInParams } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(params: BaseSwappingExactInParams): Promise<BaseSwappingExactInResult> {
        return this.doExactIn(params)
    }
}

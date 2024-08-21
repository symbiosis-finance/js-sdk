import { BaseSwapping, BaseSwappingExactInResult, BaseSwappingExactInParams } from './baseSwapping'

export class SwappingMiddleware extends BaseSwapping {
    protected middlewareAddress!: string
    protected middlewareData!: string
    protected middlewareOffset!: number

    public async exactIn(params: BaseSwappingExactInParams): Promise<BaseSwappingExactInResult> {
        const { middlewareCall } = params
        if (!middlewareCall) {
            throw new Error(`middlewareCall is required`)
        }

        const { address, data, offset } = middlewareCall

        this.middlewareAddress = address
        this.middlewareData = data
        this.middlewareOffset = offset

        return this.doExactIn(params)
    }

    protected finalReceiveSide(): string {
        return this.middlewareAddress
    }

    protected finalCalldata(): string | [] {
        return this.middlewareData
    }

    protected finalOffset(): number {
        return this.middlewareOffset
    }
}

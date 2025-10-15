import { BaseSwapping } from './baseSwapping.ts'
import { Swapping } from './swapping.ts'
import { Address, SwapExactInParams, SwapExactInResult } from '../types.ts'

export class SwappingMiddleware extends BaseSwapping {
    protected middlewareAddress!: Address
    protected middlewareData!: string
    protected middlewareOffset!: number

    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        const { middlewareCall } = params
        if (!middlewareCall) {
            const { symbiosis, omniPoolConfig } = this
            const swapping = new Swapping(symbiosis, omniPoolConfig)
            return swapping.doExactIn(params)
        }

        const { address, data, offset } = middlewareCall

        this.middlewareAddress = address
        this.middlewareData = data
        this.middlewareOffset = offset

        return this.doExactIn(params)
    }

    protected finalReceiveSide(): Address {
        return this.middlewareAddress
    }

    protected finalCalldata(): string | [] {
        return this.middlewareData
    }

    protected finalOffset(): number {
        return this.middlewareOffset
    }
}

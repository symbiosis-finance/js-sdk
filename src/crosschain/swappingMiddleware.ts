import { BaseSwapping } from './baseSwapping'
import { Swapping } from './swapping'
import { SwapExactInParams, SwapExactInResult } from './types'
import { isTonChainId } from './chainUtils'
import { SwappingFromTon } from './swappingFromTon'

export class SwappingMiddleware extends BaseSwapping {
    protected middlewareAddress!: string
    protected middlewareData!: string
    protected middlewareOffset!: number

    public async exactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        const { middlewareCall, tokenAmountIn } = params
        if (!middlewareCall) {
            const { symbiosis, omniPoolConfig } = this
            let swapping: Swapping | SwappingFromTon = new Swapping(symbiosis, omniPoolConfig)

            if (isTonChainId(tokenAmountIn.token.chainId)) {
                swapping = new SwappingFromTon(symbiosis, omniPoolConfig)
            }
            return swapping.doExactIn(params)
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

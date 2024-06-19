import { CrosschainSwapExactInResult, SwapExactInParams } from './baseSwapping'
import { Symbiosis } from './symbiosis'
import { OmniPoolConfig } from './types'
import { Swapping } from './swapping'
import { Token, TokenAmount } from '../entities'
import { Error } from './error'

type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>

export class BestTokenSwapping {
    constructor(private symbiosis: Symbiosis, private omniPoolConfig: OmniPoolConfig) {}

    public swapping?: Swapping

    public async exactIn(params: SwapExactInParams): Promise<CrosschainSwapExactInResult> {
        const { tokenAmountIn, tokenOut } = params

        const transitTokensIn = this.symbiosis.transitTokens(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokensOut = this.symbiosis.transitTokens(tokenOut.chainId, this.omniPoolConfig)

        const combinations: { transitTokenIn: Token; transitTokenOut: Token }[] = []

        transitTokensIn.forEach((transitTokenIn) => {
            transitTokensOut.forEach((transitTokenOut) => {
                combinations.push({ transitTokenIn, transitTokenOut })
            })
        })

        const promises = combinations.map(async ({ transitTokenIn, transitTokenOut }) => {
            const action = new Swapping(this.symbiosis, this.omniPoolConfig)
            const actionResult = await action.exactIn({ ...params, transitTokenIn, transitTokenOut })
            return {
                action,
                actionResult,
            }
        })

        const results = await Promise.allSettled(promises)

        let swapping: Swapping | undefined
        let result: CrosschainSwapExactInResult | undefined

        for (const item of results) {
            if (item.status !== 'fulfilled') {
                continue
            }

            const { value } = item

            if (result && result.tokenAmountOut.greaterThan(value.actionResult.tokenAmountOut)) {
                continue
            }

            swapping = value.action
            result = value.actionResult
        }

        if (!result) {
            throw new Error(`BaseSwapping: can't get the best implementation`)
        }

        this.swapping = swapping
        return result
    }

    // Need to backward compatibility to Swapping
    public get amountInUsd(): TokenAmount | undefined {
        if (!this.swapping) {
            return undefined
        }

        return this.swapping.amountInUsd
    }

    // Need to backward compatibility to Swapping
    async waitForComplete(...args: WaitForCompleteArgs) {
        if (!this.swapping) {
            throw new Error('Swapping is not started')
        }

        return this.swapping.waitForComplete(...args)
    }
}

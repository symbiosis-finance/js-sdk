import {
    BaseSwappingImplementation,
    CrosschainSwapExactInResult,
    SwapExactInParams,
} from './baseSwappingImplementation'

export abstract class BaseSwapping extends BaseSwappingImplementation {
    public async doExactIn(params: SwapExactInParams): Promise<CrosschainSwapExactInResult> {
        const { tokenAmountIn, tokenOut } = params

        const transitTokensIn = this.symbiosis.transitTokens(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokensOut = this.symbiosis.transitTokens(tokenOut.chainId, this.omniPoolConfig)

        const promises: Promise<CrosschainSwapExactInResult>[] = []
        transitTokensIn.forEach((transitTokenIn) => {
            transitTokensOut.forEach((transitTokenOut) => {
                const baseSwapping = new BaseSwappingImplementation(this.symbiosis, this.omniPoolConfig)
                promises.push(baseSwapping.doExactIn({ ...params, transitTokenIn, transitTokenOut }))
            })
        })

        const results = await Promise.allSettled(promises)

        let result: CrosschainSwapExactInResult | undefined

        for (const item of results) {
            if (item.status !== 'fulfilled') {
                continue
            }

            const { value } = item

            if (result && result.tokenAmountOut.greaterThan(value.tokenAmountOut)) {
                continue
            }

            result = value
        }

        if (!result) {
            throw new Error(`BaseSwapping: can't get the best implementation`)
        }

        return result
    }
}

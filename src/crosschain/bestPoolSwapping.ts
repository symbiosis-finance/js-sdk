import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import type { CrosschainSwapExactInResult, SwapExactInParams } from './baseSwapping'
import type { Swapping } from './swapping'
import type { Symbiosis } from './symbiosis'
import type { OmniPoolConfig } from './types'
import { Error } from './error'
import { BestTokenSwapping } from './bestTokenSwapping'
import { selectError } from './utils'

type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>

interface OptimalRoute {
    pool: OmniPoolConfig
    transitTokenIn: Token
    transitTokenOut: Token
}
// Swapping wrapper what select best omni pool for swapping
export class BestPoolSwapping {
    constructor(private symbiosis: Symbiosis) {}

    public swapping?: BestTokenSwapping | Swapping

    async exactIn({
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
        oneInchProtocols,
    }: SwapExactInParams): Promise<CrosschainSwapExactInResult> {
        const exactInParams: SwapExactInParams = {
            tokenAmountIn,
            tokenOut,
            from,
            to,
            slippage,
            deadline,
            oneInchProtocols,
        }

        const optimalRoute = this.getOptimalRoute(tokenAmountIn.token, tokenOut)
        if (optimalRoute) {
            try {
                const action = this.symbiosis.newSwapping(optimalRoute.pool)
                const actionResult = await action.exactIn({
                    ...exactInParams,
                    transitTokenIn: optimalRoute.transitTokenIn,
                    transitTokenOut: optimalRoute.transitTokenOut,
                })

                if (!this.symbiosis.isDirectRouteClient) {
                    const priceImpactThreshold = new Percent('-5', '1000') // -0.5%
                    if (actionResult.priceImpact.lessThan(priceImpactThreshold)) {
                        throw new Error('Price impact of optimal octopool is too high')
                    }
                }

                this.swapping = action
                return actionResult
            } catch (e) {
                // try to build a route through general purpose pools
            }
        }

        const { omniPools } = this.symbiosis.config

        const promises = omniPools
            .filter(
                (omniPoolConfig) =>
                    omniPoolConfig.generalPurpose || omniPoolConfig.chainExceptions?.includes(tokenOut.chainId)
            )
            .map(async (omniPoolConfig) => {
                const action = this.symbiosis.bestTokenSwapping(omniPoolConfig)

                const actionResult = await action.exactIn(exactInParams)

                return { action, actionResult }
            })

        const results = await Promise.allSettled(promises)

        let swapping: BestTokenSwapping | undefined
        let actionResult: CrosschainSwapExactInResult | undefined
        const errors: Error[] = []

        for (const item of results) {
            if (item.status !== 'fulfilled') {
                errors.push(item.reason)
                // console.error('error: ', item)
                continue
            }

            const { value } = item

            if (actionResult && actionResult.tokenAmountOut.greaterThan(value.actionResult.tokenAmountOut)) {
                continue
            }

            swapping = value.action
            actionResult = value.actionResult
        }

        if (!actionResult || !swapping) {
            throw selectError(errors)
        }

        this.swapping = swapping
        return actionResult
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

    private getOptimalRoute(tokenIn: Token, tokenOut: Token): OptimalRoute | undefined {
        const { omniPools } = this.symbiosis.config

        let optimal: OptimalRoute | undefined
        for (let i = 0; i < omniPools.length; i++) {
            const pool = omniPools[i]
            const transitTokenIn = this.symbiosis.transitTokens(tokenIn.chainId, pool).find((transitToken) => {
                return transitToken.equals(wrappedToken(tokenIn))
            })
            const transitTokenOut = this.symbiosis.transitTokens(tokenOut.chainId, pool).find((transitToken) => {
                return transitToken.equals(wrappedToken(tokenOut))
            })

            if (transitTokenIn && transitTokenOut) {
                optimal = {
                    transitTokenIn,
                    transitTokenOut,
                    pool,
                }
                break
            }
        }

        if (optimal) {
            return optimal
        }

        for (let i = 0; i < omniPools.length; i++) {
            try {
                const pool = omniPools[i]
                const transitTokenIn = this.symbiosis.transitToken(tokenIn.chainId, pool)
                const transitTokenOut = this.symbiosis.transitTokens(tokenOut.chainId, pool).find((transitToken) => {
                    return transitToken.equals(wrappedToken(tokenOut))
                })

                if (transitTokenOut) {
                    optimal = {
                        transitTokenIn,
                        transitTokenOut,
                        pool,
                    }
                    break
                }
            } catch {
                // next
            }
        }
        return optimal
    }
}

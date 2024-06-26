import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import type { CrosschainSwapExactInResult, SwapExactInParams } from './baseSwapping'
import type { Swapping } from './swapping'
import type { Symbiosis } from './symbiosis'
import type { OmniPoolConfig } from './types'
import { Error } from './error'
import { BestTokenSwapping } from './bestTokenSwapping'
import { selectError } from './utils'

type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>

// Swapping wrapper what select best omni pool for swapping
export class BestPoolSwapping {
    constructor(private symbiosis: Symbiosis) {}

    public swapping?: BestTokenSwapping

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

        const optimalOmniPool = this.getOptimalOmniPool(tokenAmountIn.token, tokenOut)
        if (optimalOmniPool) {
            try {
                const action = this.symbiosis.bestTokenSwapping(optimalOmniPool)
                const actionResult = await action.exactIn(exactInParams)

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
            .filter((omniPoolConfig) => omniPoolConfig.generalPurpose)
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

    private getOptimalOmniPool(tokenIn: Token, tokenOut: Token): OmniPoolConfig | undefined {
        const { omniPools } = this.symbiosis.config

        const swapWithoutTrades = omniPools.find((omniPoolConfig) => {
            try {
                const transitTokenIn = this.symbiosis.transitToken(tokenIn.chainId, omniPoolConfig)
                const transitTokenOut = this.symbiosis.transitToken(tokenOut.chainId, omniPoolConfig)

                return transitTokenIn.equals(wrappedToken(tokenIn)) && transitTokenOut.equals(wrappedToken(tokenOut))
            } catch {
                return false
            }
        })

        if (swapWithoutTrades) {
            return swapWithoutTrades
        }

        return omniPools.find((omniPoolConfig) => {
            try {
                // error will be thrown if there is no transit token
                this.symbiosis.transitToken(tokenIn.chainId, omniPoolConfig)

                const transitTokenOut = this.symbiosis.transitToken(tokenOut.chainId, omniPoolConfig)

                return transitTokenOut.equals(wrappedToken(tokenOut))
            } catch {
                return false
            }
        })
    }
}

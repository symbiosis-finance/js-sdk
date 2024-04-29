import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import type { CrosschainSwapExactInResult, SwapExactInParams } from './baseSwapping'
import type { Swapping } from './swapping'
import type { Symbiosis } from './symbiosis'
import type { OmniPoolConfig } from './types'
import { Error, ErrorCode } from './error'
import {utils} from "ethers";

type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>

// TODO move to Symbiosis instance' params
const DIRECT_ROUTE_CLIENTS = [
    utils.formatBytes32String('lifi')
]

// Swapping wrapper what select best omni pool for swapping
export class BestPoolSwapping {
    constructor(private symbiosis: Symbiosis) {}

    public swapping?: Swapping

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
                const action = this.symbiosis.newSwapping(optimalOmniPool)
                const actionResult = await action.exactIn(exactInParams)

                if (!DIRECT_ROUTE_CLIENTS.includes(this.symbiosis.clientId)) {
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
                const action = this.symbiosis.newSwapping(omniPoolConfig)

                const actionResult = await action.exactIn(exactInParams)

                return { action, actionResult }
            })

        const results = await Promise.allSettled(promises)

        let swapping: Swapping | undefined
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
            const uniqueCodes = errors
                .map((i) => i.code)
                .reduce((acc, i) => {
                    if (!acc.includes(i)) {
                        acc.push(i)
                    }
                    return acc
                }, [] as ErrorCode[])

            // if all errors are same return first of them
            if (uniqueCodes.length === 1) {
                throw errors[0]
            }
            // skip no transit token error (no chains pair)
            const otherErrors = errors.filter((e) => {
                return e.code !== ErrorCode.NO_TRANSIT_TOKEN
            })

            if (otherErrors.length > 0) {
                throw otherErrors[0]
            }
            throw errors[0]
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

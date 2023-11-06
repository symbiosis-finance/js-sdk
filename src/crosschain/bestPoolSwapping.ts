import type { Symbiosis } from './symbiosis'
import type { Swapping } from './swapping'
import type { OmniPoolConfig } from './types'
import type { SwapExactInParams } from './baseSwapping'
import { ErrorCode } from './error'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { utils } from 'ethers'

type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>
type FindTransitTokenSentArgs = Parameters<typeof Swapping.prototype.findTransitTokenSent>

const SOCKET_IO_PARTNER_ID = utils.formatBytes32String('socket-io')

// Swapping wrapper what select best omni pool for swapping
export class BestPoolSwapping {
    constructor(private symbiosis: Symbiosis) {}

    public swapping?: Swapping

    private getOptimalOmniPool(tokenIn: Token, tokenOut: Token): OmniPoolConfig | undefined {
        if (this.symbiosis.clientId !== SOCKET_IO_PARTNER_ID) {
            return undefined
        }

        const { omniPools } = this.symbiosis.config

        const swapWithoutTrades = omniPools.find((omniPoolConfig) => {
            const transitTokenIn = this.symbiosis.transitToken(tokenIn.chainId, omniPoolConfig)
            const transitTokenOut = this.symbiosis.transitToken(tokenOut.chainId, omniPoolConfig)

            return transitTokenIn.equals(wrappedToken(tokenIn)) && transitTokenOut.equals(wrappedToken(tokenOut))
        })

        if (swapWithoutTrades) {
            return swapWithoutTrades
        }

        return omniPools.find((omniPoolConfig) => {
            const transitTokenOut = this.symbiosis.transitToken(tokenOut.chainId, omniPoolConfig)

            return transitTokenOut.equals(wrappedToken(tokenOut))
        })
    }

    async exactIn({ tokenAmountIn, tokenOut, from, to, slippage, deadline, oneInchProtocols }: SwapExactInParams) {
        const { omniPools } = this.symbiosis.config

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
            const action = this.symbiosis.newSwapping(optimalOmniPool)
            const actionResult = await action.exactIn(exactInParams)

            this.swapping = action
            return actionResult
        }

        const results = await Promise.allSettled(
            omniPools.map(async (omniPoolConfig) => {
                const action = this.symbiosis.newSwapping(omniPoolConfig)

                const actionResult = await action.exactIn(exactInParams)

                return { action, actionResult }
            })
        )

        let swapping: any
        let actionResult: any
        let actionError: any

        for (const item of results) {
            if (item.status !== 'fulfilled') {
                if (!actionError || item.reason.code !== ErrorCode.NO_TRANSIT_TOKEN) {
                    actionError = item.reason
                }

                console.error('error: ', item)
                continue
            }

            const { value } = item

            if (actionResult && actionResult.tokenAmountOut.greaterThan(value.actionResult.tokenAmountOut)) {
                continue
            }

            swapping = value.action
            actionResult = value.actionResult
        }

        if (!actionResult) {
            throw actionError
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

    // Need to backward compatibility to Swapping
    async findTransitTokenSent(...args: FindTransitTokenSentArgs) {
        if (!this.swapping) {
            throw new Error('Swapping is not started')
        }

        return this.swapping.findTransitTokenSent(...args)
    }
}

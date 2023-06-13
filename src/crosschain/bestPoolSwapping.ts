import type { Symbiosis } from './symbiosis'
import type { Swapping } from './swapping'
import type { OmniPoolConfig } from './types'
import type { SwapOptions } from './baseSwapping'
import { TokenAmount } from 'src/entities'

type ExactInArgs = Parameters<typeof Swapping.prototype.doExactIn>
type WaitForCompleteArgs = Parameters<typeof Swapping.prototype.waitForComplete>

// Swapping wrapper what select best omni pool for swapping
export class BestPoolSwapping {
    constructor(private symbiosis: Symbiosis) {}

    public swapping?: Swapping

    async exactIn(...args: ExactInArgs) {
        const [tokenAmountIn, tokenOut, from, to, revertableAddress, slippage, deadline, useAggregators, options] = args

        const omniPools: OmniPoolConfig[] = [
            // Stable pool
            {
                chainId: 56288,
                address: '0x6148FD6C649866596C3d8a971fC313E5eCE84882',
                oracle: '0x7775b274f0C3fA919B756b22A4d9674e55927ab8',
            },
            // ETH pool
            {
                chainId: 56288,
                address: '0xBcc2637DFa64999F75abB53a7265b5B4932e40eB',
                oracle: '0x628613064b1902a1A422825cf11B687C6f17961E',
            },
        ]

        const results = await Promise.allSettled(
            omniPools.map(async (poolConfig) => {
                const action = this.symbiosis.newSwapping()

                const optionsWithPool: SwapOptions = {
                    ...options,
                    omniPoolConfig: poolConfig,
                }
                const actionResult = await action.exactIn(
                    tokenAmountIn,
                    tokenOut,
                    from,
                    to,
                    revertableAddress,
                    slippage,
                    deadline,
                    useAggregators,
                    optionsWithPool
                )

                return { action, actionResult }
            })
        )

        let swapping: any
        let actionResult: any
        let actionError: any

        for (const item of results) {
            if (item.status !== 'fulfilled') {
                actionError = item.reason
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
}

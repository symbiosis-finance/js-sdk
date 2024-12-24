import { Percent, Token, wrappedToken } from '../../../entities'
import type { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import { bestTokenSwapping } from './bestTokenSwapping'
import { Symbiosis } from '../../symbiosis'
import { theBest } from '../utils'

interface OptimalRoute {
    pool: OmniPoolConfig
    transitTokenIn: Token
    transitTokenOut: Token
}

// Swapping wrapper what select the best pool for swapping
export async function bestPoolSwapping(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut, selectMode } = params
    const optimalRoute = getOptimalRoute(symbiosis, tokenAmountIn.token, tokenOut)

    const promises: Promise<SwapExactInResult>[] = []
    if (optimalRoute) {
        try {
            const optimalPromise = symbiosis.newSwapping(optimalRoute.pool).exactIn({
                ...params,
                transitTokenIn: optimalRoute.transitTokenIn,
                transitTokenOut: optimalRoute.transitTokenOut,
            })
            promises.push(optimalPromise)
            const result = await optimalPromise

            const threshold = new Percent('-1', '100') // -1%
            if (result.priceImpact.greaterThan(threshold)) {
                return result
            }
        } catch (e) {
            console.error('Optimal route has not been built', e)
        }
    }

    const { omniPools } = symbiosis.config

    promises.push(
        ...omniPools
            .filter((poolConfig) => poolConfig.generalPurpose)
            .map((poolConfig) => bestTokenSwapping(params, poolConfig))
    )

    return theBest(promises, selectMode)
}

function getOptimalRoute(symbiosis: Symbiosis, tokenIn: Token, tokenOut: Token): OptimalRoute | undefined {
    const { omniPools } = symbiosis.config

    let optimal: OptimalRoute | undefined
    for (let i = 0; i < omniPools.length; i++) {
        const pool = omniPools[i]
        const transitTokenIn = symbiosis.transitTokens(tokenIn.chainId, pool).find((transitToken) => {
            return transitToken.equals(wrappedToken(tokenIn))
        })
        const transitTokenOut = symbiosis.transitTokens(tokenOut.chainId, pool).find((transitToken) => {
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
            const transitTokenIn = symbiosis.transitToken(tokenIn.chainId, pool)
            const transitTokenOut = symbiosis.transitTokens(tokenOut.chainId, pool).find((transitToken) => {
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

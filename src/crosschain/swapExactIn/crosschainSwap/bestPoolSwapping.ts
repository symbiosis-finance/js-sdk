import { Percent, Token, wrappedToken } from '../../../entities/index.ts'
import type { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types.ts'
import { Symbiosis } from '../../symbiosis.ts'
import { theBest } from '../utils.ts'

interface Route {
    poolConfig: OmniPoolConfig
    transitTokenIn: Token
    transitTokenOut: Token
}

// Swapping wrapper what select the best pool for swapping
export async function bestPoolSwapping(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut, selectMode } = params

    const routes = getRoutes(symbiosis, tokenAmountIn.token, tokenOut)
    const optimalRoute = getOptimalRoute(symbiosis, tokenAmountIn.token, tokenOut)
    if (optimalRoute) {
        const result = await tryRoute(symbiosis, optimalRoute, params)

        // remove the optimal route from the list of routes
        const otherRoutes = routes.filter((route) => !areRoutesEqual(route, optimalRoute))
        // there are no alternatives, return the optimal route result
        if (otherRoutes.length === 0) {
            return result
        }
        const threshold = new Percent('-1', '100') // -1%
        if (result.priceImpact.greaterThan(threshold)) {
            return result
        } else {
            symbiosis.context?.logger.error(
                `Price impact of the optimal route is too high ${result.priceImpact.toFixed()}%`
            )

            const exist = routes.find((route) => areRoutesEqual(route, optimalRoute))
            if (!exist) {
                routes.push(optimalRoute)
            }
        }
    }

    const promises = routes.map((route) => tryRoute(symbiosis, route, params))

    return theBest(promises, selectMode)
}

function tryRoute(symbiosis: Symbiosis, route: Route, params: SwapExactInParams): Promise<SwapExactInResult> {
    const { transitTokenIn, transitTokenOut, poolConfig } = route
    return symbiosis.newSwapping(poolConfig).exactIn({
        ...params,
        transitTokenIn,
        transitTokenOut,
    })
}

function areRoutesEqual(routeA: Route, routeB: Route): boolean {
    return (
        routeA.poolConfig.chainId === routeB.poolConfig.chainId &&
        routeA.poolConfig.address.toLowerCase() === routeB.poolConfig.address.toLowerCase() &&
        routeA.transitTokenIn.equals(routeB.transitTokenIn) &&
        routeA.transitTokenOut.equals(routeB.transitTokenOut)
    )
}

function getRoutes(symbiosis: Symbiosis, tokenIn: Token, tokenOut: Token): Route[] {
    const routes: Route[] = []
    const generalPurposePools = symbiosis.config.omniPools.filter((poolConfig) => poolConfig.generalPurpose)
    for (const poolConfig of generalPurposePools) {
        const transitCombinations = symbiosis.getTransitCombinations(tokenIn.chainId, tokenOut.chainId, poolConfig)
        for (const { transitTokenIn, transitTokenOut } of transitCombinations) {
            routes.push({
                transitTokenIn,
                transitTokenOut,
                poolConfig,
            })
        }
    }
    return routes
}

function getOptimalRoute(symbiosis: Symbiosis, tokenIn: Token, tokenOut: Token): Route | undefined {
    const { omniPools } = symbiosis.config

    let optimal: Route | undefined

    // direct route
    for (const poolConfig of omniPools) {
        const transitTokenIn = symbiosis.transitTokens(tokenIn.chainId, poolConfig).find((transitToken) => {
            return transitToken.equals(wrappedToken(tokenIn))
        })
        const transitTokenOut = symbiosis.transitTokens(tokenOut.chainId, poolConfig).find((transitToken) => {
            return transitToken.equals(wrappedToken(tokenOut))
        })

        if (transitTokenIn && transitTokenOut) {
            optimal = {
                transitTokenIn,
                transitTokenOut,
                poolConfig,
            }
            break
        }
    }

    if (optimal) {
        return optimal
    }

    // with routing on a source chain
    for (const poolConfig of omniPools) {
        try {
            const transitTokenIn = symbiosis.transitToken(tokenIn.chainId, poolConfig)
            const transitTokenOut = symbiosis.transitTokens(tokenOut.chainId, poolConfig).find((transitToken) => {
                return transitToken.equals(wrappedToken(tokenOut))
            })

            if (transitTokenOut) {
                optimal = {
                    transitTokenIn,
                    transitTokenOut,
                    poolConfig,
                }
                break
            }
        } catch {
            // next
        }
    }

    if (optimal) {
        return optimal
    }

    // select a route from the list if there is only one
    const possibleRoutes: Route[] = []
    for (const poolConfig of omniPools) {
        try {
            const transitTokenIn = symbiosis.transitToken(tokenIn.chainId, poolConfig)
            const transitTokenOut = symbiosis.transitToken(tokenOut.chainId, poolConfig)

            if (transitTokenIn && transitTokenOut) {
                possibleRoutes.push({
                    transitTokenIn,
                    transitTokenOut,
                    poolConfig,
                })
            }
        } catch {
            // next
        }
    }

    if (possibleRoutes.length === 1) {
        return possibleRoutes[0]
    }

    return undefined
}

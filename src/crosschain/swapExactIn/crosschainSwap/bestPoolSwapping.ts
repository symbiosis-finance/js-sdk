import { Token, wrappedToken } from '../../../entities/index.ts'
import type { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types.ts'
import { Symbiosis } from '../../symbiosis.ts'
import { theBest } from '../utils.ts'

export interface Route {
    poolConfig: OmniPoolConfig
    transitTokenIn: Token
    transitTokenOut: Token
    optimal: boolean
}

// Swapping wrapper what select the best pool for swapping
export async function bestPoolSwapping(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut, selectMode, disableSrcChainRouting, disableDstChainRouting } = params

    const routes = getRoutes({
        symbiosis,
        tokenIn: tokenAmountIn.token,
        tokenOut,
        disableSrcChainRouting,
        disableDstChainRouting,
    })

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

export function getRoutes({
    symbiosis,
    tokenIn,
    tokenOut,
    disableSrcChainRouting,
    disableDstChainRouting,
}: {
    symbiosis: Symbiosis
    tokenIn: Token
    tokenOut: Token
    disableSrcChainRouting?: boolean
    disableDstChainRouting?: boolean
}): Route[] {
    const optimalRoute = getOptimalRoute({
        symbiosis,
        tokenIn,
        tokenOut,
        disableSrcChainRouting,
        disableDstChainRouting,
    })
    if (optimalRoute) {
        return [optimalRoute]
    }

    const routes: Route[] = []
    const generalPurposePools = symbiosis.config.omniPools.filter((poolConfig) => poolConfig.generalPurpose)
    for (const poolConfig of generalPurposePools) {
        const transitCombinations = symbiosis.getTransitCombinations({
            poolConfig,
            tokenIn,
            tokenOut,
            disableSrcChainRouting,
            disableDstChainRouting,
        })
        for (const { transitTokenIn, transitTokenOut } of transitCombinations) {
            routes.push({
                transitTokenIn,
                transitTokenOut,
                poolConfig,
                optimal: false,
            })
        }
    }
    return routes
}

function getOptimalRoute({
    symbiosis,
    tokenIn,
    tokenOut,
    disableSrcChainRouting,
    disableDstChainRouting,
}: {
    symbiosis: Symbiosis
    tokenIn: Token
    tokenOut: Token
    disableSrcChainRouting?: boolean
    disableDstChainRouting?: boolean
}): Route | undefined {
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
                optimal: true,
            }
            break
        }
    }

    if (optimal) {
        return optimal
    }

    // if source chain routing is allowed
    if (!disableSrcChainRouting) {
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
                        optimal: true,
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
    }

    // if destination chain routing is allowed
    if (!disableDstChainRouting) {
        for (const poolConfig of omniPools) {
            try {
                const transitTokenIn = symbiosis.transitTokens(tokenIn.chainId, poolConfig).find((transitToken) => {
                    return transitToken.equals(wrappedToken(tokenIn))
                })
                const transitTokenOut = symbiosis.transitToken(tokenOut.chainId, poolConfig)

                if (transitTokenIn) {
                    optimal = {
                        transitTokenIn,
                        transitTokenOut,
                        poolConfig,
                        optimal: true,
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
    }

    // select a route from the list if there is only one
    const possibleRoutes: Route[] = []
    for (const poolConfig of omniPools) {
        try {
            const transitTokenIn = symbiosis.transitToken(tokenIn.chainId, poolConfig)
            if (disableSrcChainRouting && !transitTokenIn.equals(wrappedToken(tokenIn))) {
                continue
            }
            const transitTokenOut = symbiosis.transitToken(tokenOut.chainId, poolConfig)
            if (disableDstChainRouting && !transitTokenIn.equals(wrappedToken(tokenOut))) {
                continue
            }

            if (transitTokenIn && transitTokenOut) {
                possibleRoutes.push({
                    transitTokenIn,
                    transitTokenOut,
                    poolConfig,
                    optimal: true,
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

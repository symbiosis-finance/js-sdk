import { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import { theBest } from '../utils'

export async function bestTokenSwapping(
    params: SwapExactInParams,
    poolConfig: OmniPoolConfig
): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params

    const combinations = symbiosis.getTransitCombinations(tokenAmountIn.token.chainId, tokenOut.chainId, poolConfig)
    const promises = combinations.map(({ transitTokenIn, transitTokenOut }) => {
        const action = symbiosis.newSwapping(poolConfig)
        return action.exactIn({ ...params, transitTokenIn, transitTokenOut })
    })

    return theBest(promises, symbiosis.selectMode)
}

import { SwapExactInParams, SwapExactInResult } from '../../types'
import { unwrapBtc } from './unwrapBtc'
import { theBest } from '../utils'
import { ZappingBtc } from '../../swapping'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to, selectMode } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.chains.forEach((chain) => {
        const syBtc = symbiosis.getRepresentation(tokenOut, chain.id)
        if (!syBtc) {
            return
        }

        if (tokenAmountIn.token.equals(syBtc)) {
            promises.push(unwrapBtc(context))
            return
        }

        // if (tokenAmountIn.token.chainId === syBtc.chainId) {
        //     promises.push(zappingBtcOnChain(context))
        //     return
        // }

        symbiosis.config.omniPools
            .filter((poolConfig) => poolConfig.generalPurpose)
            .forEach((poolConfig) => {
                const combinations = symbiosis.getTransitCombinations(
                    tokenAmountIn.token.chainId,
                    syBtc.chainId,
                    poolConfig
                )
                combinations.forEach(({ transitTokenIn, transitTokenOut }) => {
                    const zappingBtc = new ZappingBtc(symbiosis, poolConfig)
                    const { from, slippage, deadline } = context

                    const promise = zappingBtc.exactIn({
                        tokenAmountIn,
                        syBtc,
                        from,
                        to,
                        slippage,
                        deadline,
                        transitTokenIn,
                        transitTokenOut,
                    })
                    promises.push(promise)
                })
            })
    })

    return theBest(promises, selectMode)
}

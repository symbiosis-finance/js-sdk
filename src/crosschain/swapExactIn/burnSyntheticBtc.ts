import { SwapExactInParams, SwapExactInResult } from '../types'
import { UnwrapBtc } from '../unwrapBtc'
import { zappingBtcOnChain } from '../zappingBtcOnChain'
import { theBestOutput } from './utils'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.chains.forEach((chain) => {
        const syBtc = symbiosis.getRepresentation(tokenOut, chain.id)
        if (!syBtc) {
            return
        }

        if (tokenAmountIn.token.equals(syBtc)) {
            const burn = new UnwrapBtc(symbiosis)
            promises.push(
                burn.exactIn({
                    tokenAmountIn,
                    to,
                })
            )
            return
        }

        if (tokenAmountIn.token.chainId === syBtc.chainId) {
            promises.push(zappingBtcOnChain(context))
            return
        }

        symbiosis.config.omniPools
            .filter((poolConfig) => poolConfig.generalPurpose)
            .forEach((poolConfig) => {
                const combinations = symbiosis.getTransitCombinations(
                    tokenAmountIn.token.chainId,
                    syBtc.chainId,
                    poolConfig
                )
                combinations.forEach(({ transitTokenIn, transitTokenOut }) => {
                    const zappingBtc = symbiosis.newZappingBtc(poolConfig)
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

    return theBestOutput(promises)
}

import { SwapExactInParams, SwapExactInResult } from '../../types'
import { unwrapBtc } from './unwrapBtc'
import { theBest } from '../utils'
import { ZappingBtc } from '../../swapping'
import { BTC_CONFIGS } from '../../chainUtils/btc'
import { zappingBtcOnChain } from './zappingBtcOnChain'

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, symbiosis, to, selectMode } = context

    const promises: Promise<SwapExactInResult>[] = []

    BTC_CONFIGS.forEach(({ btc, symBtc }) => {
        const syBtc = symbiosis.getRepresentation(btc, symBtc.chainId)
        if (!syBtc) {
            return
        }

        if (tokenAmountIn.token.equals(syBtc)) {
            promises.push(unwrapBtc(context))
            return
        }

        if (tokenAmountIn.token.chainId === syBtc.chainId) {
            promises.push(zappingBtcOnChain(context, syBtc))
            return
        }

        const pools = [
            ...symbiosis.config.omniPools.filter((i) => i.generalPurpose),
            symbiosis.config.omniPools[2], // BTC pool
        ]
        pools.forEach((poolConfig) => {
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

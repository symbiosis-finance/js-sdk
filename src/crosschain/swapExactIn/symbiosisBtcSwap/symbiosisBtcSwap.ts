import { withSyncSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { zappingBtcOnChain } from './zappingBtcOnChain'
import { ZappingBtcCrossChain } from './zappingBtcCrossChain'

export function symbiosisBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withSyncSpan('symbiosisBtcSwap', {}, () => {
        const { tokenAmountIn, symbiosis, to, disableSrcChainRouting, disableDstChainRouting, disabledProviders } =
            context

        const promises: Promise<SwapExactInResult>[] = []

        symbiosis.config.btcConfigs.forEach(({ btc, symBtc }) => {
            const syBtc = symbiosis.getRepresentation(btc, symBtc.chainId)
            if (!syBtc) {
                return
            }

            // allow only to unwrap deprecated syBTC
            if (syBtc.deprecated) {
                return
            }

            if (tokenAmountIn.token.chainId === syBtc.chainId) {
                promises.push(zappingBtcOnChain(context, syBtc))
                return
            }

            symbiosis.config.omniPools
                .filter((i) => i.generalPurpose || i.coinGeckoId === 'bitcoin')
                .forEach((poolConfig) => {
                    const combinations = symbiosis.getTransitCombinations({
                        poolConfig,
                        tokenIn: tokenAmountIn.token,
                        tokenOut: syBtc,
                        disableSrcChainRouting,
                        disableDstChainRouting,
                    })
                    combinations.forEach(({ transitTokenIn, transitTokenOut }) => {
                        const zappingBtc = new ZappingBtcCrossChain(symbiosis, poolConfig)
                        const { from, slippage, deadline, partnerAddress, fallbackReceiver } = context

                        const promise = zappingBtc.exactIn({
                            tokenAmountIn,
                            syBtc,
                            from,
                            to,
                            slippage,
                            deadline,
                            transitTokenIn,
                            transitTokenOut,
                            partnerAddress,
                            fallbackReceiver,
                            disabledProviders,
                        })
                        promises.push(promise)
                    })
                })
        })

        return promises
    })
}

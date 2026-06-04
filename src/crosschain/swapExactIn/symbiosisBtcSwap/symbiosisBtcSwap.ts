import type { Token } from '../../../entities'
import { withPromisesSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import { zappingBtcOnChain } from './zappingBtcOnChain'
import { ZappingBtcCrossChain } from './zappingBtcCrossChain'
import { ChainId } from '../../../constants'

export function symbiosisBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('symbiosisBtcSwap', {}, () => {
        const { tokenAmountIn, symbiosis, to, disableSrcChainRouting, disableDstChainRouting, disabledProviders } =
            context

        const activeSyBtcs = symbiosis.config.btcConfigs
            .map(({ btc, symBtc }) => symbiosis.getRepresentation(btc, symBtc.chainId))
            .filter((syBtc): syBtc is Token => !!syBtc && !syBtc.deprecated)

        const onChainSyBtcs = activeSyBtcs.filter((syBtc) => tokenAmountIn.token.chainId === syBtc.chainId)
        if (onChainSyBtcs.length > 0) {
            return onChainSyBtcs.map((syBtc) => zappingBtcOnChain(context, syBtc))
        }

        // Ethereum and BNB chain are allowed only for cross-chain swaps
        const crossChainSyBtcs = activeSyBtcs.filter((syBtc) =>
            [ChainId.ETH_MAINNET, ChainId.BSC_MAINNET].includes(syBtc.chainId)
        )
        const promises: Promise<SwapExactInResult>[] = []
        crossChainSyBtcs.forEach((syBtc) => {
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

                        const promise = zappingBtc.exactIn(
                            {
                                tokenAmountIn,
                                syBtc,
                                from,
                                to,
                                slippage,
                                deadline,
                                partnerAddress,
                                fallbackReceiver,
                                disabledProviders,
                            },
                            transitTokenIn,
                            transitTokenOut
                        )
                        promises.push(promise)
                    })
                })
        })

        return promises
    })
}

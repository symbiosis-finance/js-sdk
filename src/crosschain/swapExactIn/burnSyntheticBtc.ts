import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { CrosschainSwapExactInResult } from '../baseSwapping'
import { Error } from '../error'
import { Token } from '../../entities'

const sBtc = new Token({
    name: 'Synthetic BTC',
    address: '0x4d0EF82dfE2896eE3222bE5a9e9188ae1DCcd05F',
    symbol: 'sBTC',
    decimals: 8,
    chainId: 11155111,
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
})

export async function burnSyntheticBtc(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    const omniPool = context.symbiosis.config.omniPools[0] // FIXME

    const promises = [sBtc].map(() => {
        const zappingThor = context.symbiosis.newZappingNativeBtc(omniPool)

        return zappingThor.exactIn({
            tokenAmountIn: inTokenAmount,
            sBtc,
            from: context.fromAddress,
            to: context.toAddress,
            slippage: context.slippage,
            deadline: context.deadline,
        })
    })

    const results = await Promise.allSettled(promises)

    let bestResult: CrosschainSwapExactInResult | undefined
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    if (!bestResult) {
        throw new Error(`Can't build route upto the Native BTC`)
    }

    const payload = {
        transactionType: bestResult.type,
        transactionRequest: bestResult.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'to-btc-swap',
        ...bestResult,
        ...payload,
    }
}

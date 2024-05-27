import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { CrosschainSwapExactInResult } from '../baseSwapping'
import { Error } from '../error'
import { Token } from '../../entities'

// FIXME
const sBtc = new Token({
    name: 't4SymBtc',
    address: '0x04cd23122a21f6c5F912FC7B9aBC508302899Dfb',
    symbol: 't4SymBtc',
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
    let error: string | undefined
    for (const item of results) {
        if (item.status !== 'fulfilled') {
            error = item.reason.message
            continue
        }

        const { value: result } = item

        if (bestResult && bestResult.tokenAmountOut.greaterThanOrEqual(result.tokenAmountOut.raw)) {
            continue
        }

        bestResult = result
    }

    if (!bestResult) {
        throw new Error(`Can't build route upto the Native BTC: ${error}`)
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

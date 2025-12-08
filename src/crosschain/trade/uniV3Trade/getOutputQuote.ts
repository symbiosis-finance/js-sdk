import type { Currency, CurrencyAmount } from '@uniswap/sdk-core'
import { TradeType } from '@uniswap/sdk-core'
import type { Route } from '@uniswap/v3-sdk'
import { SwapQuoter } from '@uniswap/v3-sdk'
import { ethers } from 'ethers'

import type { UniV3Quoter } from '../../contracts'

export async function getOutputQuote(
    quoter: UniV3Quoter,
    currencyAmount: CurrencyAmount<Currency>,
    route: Route<Currency, Currency>
) {
    const { calldata } = await SwapQuoter.quoteCallParameters(route, currencyAmount, TradeType.EXACT_INPUT, {
        useQuoterV2: true,
    })

    const quoteCallReturnData = await quoter.provider.call({
        to: quoter.address,
        data: calldata,
    })

    return ethers.utils.defaultAbiCoder.decode(['uint256'], quoteCallReturnData)
}

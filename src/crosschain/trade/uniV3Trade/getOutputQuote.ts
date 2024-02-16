import { Currency, CurrencyAmount, TradeType } from '@uniswap/sdk-core'
import { Route, SwapQuoter } from '@uniswap/v3-sdk'
import { UniV3Quoter } from '../../contracts'
import { ethers } from 'ethers'

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

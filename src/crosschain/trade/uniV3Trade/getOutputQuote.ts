import { Currency, TradeType } from '@uniswap/sdk-core'
import { Route, SwapQuoter } from '@uniswap/v3-sdk'
import { UniV3Quoter } from '../../contracts'
import { ethers } from 'ethers'
import { TokenAmount } from '../../../entities'
import { toUniTokenAmount } from './toUniTypes'

export async function getOutputQuote(quoter: UniV3Quoter, tokenAmount: TokenAmount, route: Route<Currency, Currency>) {
    const { calldata } = await SwapQuoter.quoteCallParameters(
        route,
        toUniTokenAmount(tokenAmount),
        TradeType.EXACT_INPUT,
        {
            useQuoterV2: true,
        }
    )

    const quoteCallReturnData = await quoter.provider.call({
        to: quoter.address,
        data: calldata,
    })

    return ethers.utils.defaultAbiCoder.decode(['uint256'], quoteCallReturnData)
}

import { BigNumber } from '@ethersproject/bignumber'
import { formatUnits } from '@ethersproject/units'
import JSBI from 'jsbi'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { BIPS_BASE } from '../constants'
import type { OneInchOracle } from '../contracts'
import type { DataProvider } from '../dataProvider'
import { getMulticall } from '../multicall'

export async function getRateToEth(tokens: Token[], oracle: OneInchOracle) {
    const calls = tokens.map((token) => ({
        target: oracle.address,
        callData: oracle.interface.encodeFunctionData(
            'getRateToEth',
            [token.address, true] // use wrapper
        ),
    }))

    const multicall = await getMulticall(oracle.provider)
    return multicall.callStatic.tryAggregate(false, calls)
}

interface GetTradePriceImpactParams {
    dataProvider: DataProvider
    oracle: OneInchOracle
    tokenAmountIn: TokenAmount
    tokenAmountOut: TokenAmount
}

export async function getTradePriceImpact({
    dataProvider,
    oracle,
    tokenAmountIn,
    tokenAmountOut,
}: GetTradePriceImpactParams): Promise<Percent> {
    const tokens = [wrappedToken(tokenAmountIn.token), wrappedToken(tokenAmountOut.token)]

    const aggregated = await dataProvider.getOneInchRateToEth(tokens, oracle)

    const denominator = BigNumber.from(10).pow(18) // eth decimals

    const data = aggregated.map(([success, returnData], i): BigNumber | undefined => {
        if (!success || returnData === '0x') return
        const result = oracle.interface.decodeFunctionResult('getRateToEth', returnData)

        const numerator = BigNumber.from(10).pow(tokens[i].decimals)

        return BigNumber.from(result.weightedRate).mul(numerator).div(denominator)
    })

    if (!data[0] || !data[1]) {
        throw new Error('OneInch oracle: cannot to receive rate to ETH')
    }
    const multiplierPow = 18
    const multiplier = BigNumber.from(10).pow(multiplierPow)

    const spot = data[1].mul(multiplier).div(data[0]) // with e18

    // calc real rate
    const inBn = BigNumber.from(tokenAmountIn.raw.toString()).mul(BigNumber.from(10).pow(tokenAmountOut.token.decimals))
    const outBn = BigNumber.from(tokenAmountOut.raw.toString()).mul(
        BigNumber.from(10).pow(tokenAmountIn.token.decimals)
    )
    const real = inBn.mul(multiplier).div(outBn)

    const impact = real.mul(multiplier).div(spot)
    const impactNumber = 1 - Number.parseFloat(formatUnits(impact, multiplierPow))

    return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
}

import { Percent, TokenAmount } from '../../entities'
import { MultiCallItem, VolumeFeeCollector } from '../types'
import { OctoPoolFeeCollector__factory } from '../contracts'
import { BIPS_BASE } from '../constants'
import { BigNumber } from 'ethers'

export function getVolumeFeeCall({
    feeCollector,
    amountIn,
    amountInMin,
}: {
    feeCollector: VolumeFeeCollector
    amountIn: TokenAmount
    amountInMin?: TokenAmount
}): MultiCallItem {
    const WAD = BigNumber.from(10).pow(18)
    // amountOut
    const amountInBn = BigNumber.from(amountIn.raw.toString())
    const feeBn = amountInBn.mul(feeCollector.feeRate).div(WAD)
    const fee = new TokenAmount(amountIn.token, feeBn.toString())
    const amountOut = new TokenAmount(amountIn.token, amountInBn.sub(feeBn).toString())

    // amountOutMin
    let amountOutMin = amountOut
    if (amountInMin) {
        const amountInMinBn = BigNumber.from(amountInMin.raw.toString())
        const feeMinBn = amountInMinBn.mul(feeCollector.feeRate).div(WAD)
        amountOutMin = new TokenAmount(amountInMin.token, amountInMinBn.sub(feeMinBn).toString())
    }
    const data = OctoPoolFeeCollector__factory.createInterface().encodeFunctionData('collectFee', [
        amountIn.raw.toString(),
        amountIn.token.address,
    ])

    return {
        priceImpact: new Percent('0', BIPS_BASE),
        amountIn,
        amountOut,
        amountOutMin,
        to: feeCollector.address,
        data,
        value: '0',
        offset: 36,
        fees: [
            {
                provider: 'symbiosis',
                description: 'Volume fee',
                value: fee,
            },
        ],
        routes: [],
    }
}

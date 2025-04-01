import { Percent, TokenAmount } from '../../entities'
import { MultiCallItem, VolumeFeeCollector } from '../types'
import { OctoPoolFeeCollector__factory } from '../contracts'
import { BIPS_BASE } from '../constants'
import { ChainId } from '../../constants'
import { BigNumber } from 'ethers'

const DEFAULT_BTC_VOLUME_FEE_COLLECTOR: VolumeFeeCollector = {
    chainId: ChainId.BSC_MAINNET,
    address: '0x3743c756b64ECd0770f1d4f47696A73d2A46dcbe',
    feeRate: '2000000000000000', // 0.2%
    eligibleChains: [],
}

export async function getVolumeFeeCall({
    amountIn,
    amountInMin,
}: {
    amountIn: TokenAmount
    amountInMin?: TokenAmount
}): Promise<MultiCallItem | undefined> {
    const feeCollector = DEFAULT_BTC_VOLUME_FEE_COLLECTOR
    if (feeCollector.chainId !== amountIn.token.chainId) {
        return
    }

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

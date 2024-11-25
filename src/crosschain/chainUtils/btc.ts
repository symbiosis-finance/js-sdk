import { TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'
import { BigNumber } from 'ethers'
import { Synthesis } from '../contracts'
import { ChainId } from '../../constants'

export const getToBtcFee = async (syBtcAmount: TokenAmount, synthesis: Synthesis, dataProvider: DataProvider) => {
    const syBtc = syBtcAmount.token
    let fee = await dataProvider.get(
        ['syntToMinFeeBTC', synthesis.address, syBtc.address],
        async () => {
            return synthesis.syntToMinFeeBTC(syBtc.address)
        },
        600 // 10 minutes
    )

    try {
        const fastestFee = await dataProvider.get(['getFastestFee'], getFastestFee, 60) // 1 minute
        const recommendedFee = BigNumber.from(fastestFee * 300) // 300 vByte
        if (recommendedFee.gt(fee)) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }

    // fee 1.5%
    const volumeFee = BigNumber.from(syBtcAmount.raw.toString()).mul(15).div(1000)

    return new TokenAmount(syBtc, fee.add(volumeFee).toString())
}

export function isBtcChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.BTC_MAINNET, ChainId.BTC_MUTINY, ChainId.BTC_TESTNET4].includes(chainId)
}

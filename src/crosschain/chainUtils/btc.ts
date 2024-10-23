import { Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { getFastestFee } from '../mempool'
import { BigNumber } from 'ethers'
import { Synthesis } from '../contracts'
import { ChainId } from '../../constants'

export const getToBtcFee = async (syBtc: Token, synthesis: Synthesis, dataProvider: DataProvider) => {
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
    return new TokenAmount(syBtc, fee.toString())
}

export function isBtcChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.BTC_MAINNET, ChainId.BTC_MUTINY, ChainId.BTC_TESTNET4].includes(chainId)
}

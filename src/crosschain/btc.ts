import { Token, TokenAmount } from '../entities'
import { DataProvider } from './dataProvider'
import { getFastestFee } from './mempool'
import { BigNumber } from 'ethers'
import { Synthesis } from './contracts'

export const getToBtcFee = async (syBtc: Token, synthesis: Synthesis, dataProvider: DataProvider) => {
    let fee = await dataProvider.get(
        ['syntToMinFeeBTC', synthesis.address, syBtc.address],
        async () => {
            return synthesis.syntToMinFeeBTC(syBtc.address)
        },
        600 // 10 minutes
    )

    try {
        const recommendedFee = await dataProvider.get(
            ['getFastestFee'],
            async () => {
                const fastestFee = await getFastestFee()
                return BigNumber.from(fastestFee * 100)
            },
            60 // 1 minute
        )
        if (recommendedFee.gt(fee)) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }
    return new TokenAmount(syBtc, fee.toString())
}

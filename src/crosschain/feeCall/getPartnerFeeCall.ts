import { Symbiosis } from '../symbiosis'
import { Percent, Token, TokenAmount } from '../../entities'
import { MultiCallItem, PartnerFeeCallParams } from '../types'
import { PartnerFeeCollector__factory } from '../contracts'
import { BigNumber } from 'ethers'
import { BIPS_BASE } from '../constants'

export async function getPartnerFeeCallParams({
    symbiosis,
    partnerAddress,
    token,
}: {
    symbiosis: Symbiosis
    partnerAddress: string
    token: Token
}): Promise<PartnerFeeCallParams | undefined> {
    const { chainId } = token
    const partnerFeeCollectorAddress = symbiosis.chainConfig(chainId).partnerFeeCollector
    if (!partnerFeeCollectorAddress) {
        return
    }
    const partnerFeeCollector = PartnerFeeCollector__factory.connect(
        partnerFeeCollectorAddress,
        symbiosis.getProvider(chainId)
    )
    const { isActive, feeRate } = await symbiosis.cache.get(
        ['partnerFeeCollector', partnerFeeCollectorAddress, chainId.toString(), partnerAddress],
        () => partnerFeeCollector.callStatic.partners(partnerAddress),
        24 * 60 * 60 // 24 hours
    )
    if (!isActive) {
        return
    }
    const fixedFee = await symbiosis.cache.get(
        ['partnerFeeCollector', partnerFeeCollectorAddress, chainId.toString(), partnerAddress, token.address],
        () => partnerFeeCollector.callStatic.fixedFee(partnerAddress, token.address),
        24 * 60 * 60 // 24 hours
    )

    return {
        partnerAddress,
        partnerFeeCollector,
        feeRate,
        fixedFee,
    }
}

export function getPartnerFeeCall({
    partnerFeeCallParams,
    amountIn,
    amountInMin,
}: {
    partnerFeeCallParams: PartnerFeeCallParams
    amountIn: TokenAmount
    amountInMin?: TokenAmount
}): MultiCallItem {
    const { partnerAddress, partnerFeeCollector, feeRate, fixedFee } = partnerFeeCallParams

    const WAD = BigNumber.from(10).pow(18)
    // amountOut
    const amountInBn = BigNumber.from(amountIn.raw.toString())
    const percentageFee = amountInBn.mul(feeRate).div(WAD)
    const totalFee = percentageFee.add(fixedFee)
    const fee = new TokenAmount(amountIn.token, totalFee.toString())
    const amountOut = new TokenAmount(amountIn.token, amountInBn.sub(totalFee).toString())

    // min amountOut
    let amountOutMin = amountOut
    if (amountInMin) {
        const amountInMinBn = BigNumber.from(amountInMin.raw.toString())
        const percentageFeeMin = amountInMinBn.mul(feeRate).div(WAD)
        const totalFeeMin = percentageFeeMin.add(fixedFee)
        amountOutMin = new TokenAmount(amountIn.token, amountInMinBn.sub(totalFeeMin).toString())
    }

    const data = partnerFeeCollector.interface.encodeFunctionData('collectFee', [
        amountIn.raw.toString(),
        amountIn.token.address,
        partnerAddress,
    ])

    return {
        priceImpact: new Percent('0', BIPS_BASE),
        amountIn,
        amountOut,
        amountOutMin,
        to: partnerFeeCollector.address,
        data,
        value: '0',
        offset: 36,
        fees: [
            {
                provider: 'symbiosis',
                description: 'Partner fee',
                value: fee,
            },
        ],
        routes: [],
    }
}

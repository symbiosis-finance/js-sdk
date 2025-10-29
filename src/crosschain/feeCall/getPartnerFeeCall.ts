import { Symbiosis } from '../symbiosis.ts'
import { Percent, Token, TokenAmount } from '../../entities/index.ts'
import { MultiCallItem, PartnerFeeCallParams } from '../types.ts'
import { PartnerFeeCollector__factory } from '../contracts/index.ts'
import { BigNumber } from 'ethers'
import { BIPS_BASE } from '../constants.ts'

async function getPartnerFeeCallParams({
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

function getPartnerFeeCallItem({
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

export async function getPartnerFeeCall({
    symbiosis,
    amountIn,
    amountInMin,
    partnerAddress,
}: {
    symbiosis: Symbiosis
    amountIn: TokenAmount
    amountInMin?: TokenAmount
    partnerAddress?: string
}): Promise<MultiCallItem | undefined> {
    if (!partnerAddress) {
        return
    }
    const { token } = amountIn
    const partnerFeeCallParams = await getPartnerFeeCallParams({
        symbiosis,
        partnerAddress,
        token,
    })
    if (!partnerFeeCallParams) {
        return
    }

    return getPartnerFeeCallItem({
        partnerFeeCallParams,
        amountIn,
        amountInMin,
    })
}

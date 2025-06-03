import { AddressZero } from '@ethersproject/constants'
import { BigNumber, BytesLike, utils } from 'ethers'
import { ChainId } from '../../constants'
import { GAS_TOKEN, TokenAmount } from '../../entities'
import { onchainSwap } from './onchainSwap'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { FeeCollector__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { getFunctionSelector, tronAddressToEvm } from '../chainUtils/tron'
import { Error, ErrorCode } from '../error'

export const ZERO_FEE_COLLECTOR_ADDRESSES: Partial<Record<ChainId, string>> = {
    [ChainId.ZKSYNC_MAINNET]: '0x35e3dc1f3383bD348EC651EdD73fE1d7a7dA5AAa',
    [ChainId.BSC_MAINNET]: '0x628613064b1902a1A422825cf11B687C6f17961E',
    [ChainId.RSK_MAINNET]: '0xa257f3fe4e4032291516dc355edf90664e9eb932',
}

export const FEE_COLLECTOR_ADDRESSES: Partial<Record<ChainId, string>> = {
    [ChainId.ETH_MAINNET]: '0xff9b21c3bfa4bce9b20b55fed56d102ced48b0f6',
    [ChainId.BSC_MAINNET]: '0x0425841529882628880fBD228AC90606e0c2e09A',
    [ChainId.AVAX_MAINNET]: '0xA257F3FE4E4032291516DC355eDF90664e9eB932',
    [ChainId.MATIC_MAINNET]: '0x9d74807B8fA79d49bb95CF988Af3c25Fb1437B4f',
    [ChainId.MANTLE_MAINNET]: '0x7B4E28E7273aA8CB64C56fF191ebF43b64f409F9',
    [ChainId.LINEA_MAINNET]: '0x0f91052dc5B4baE53d0FeA5DAe561A117268f5d2',
    [ChainId.POLYGON_ZK]: '0xB79A4F5828eb55c10D7abF4bFe9a9f5d11aA84e0',
    [ChainId.BASE_MAINNET]: '0xF951789c6A356BfbC3033648AA10b5Dd3e9d88C0',
    [ChainId.ARBITRUM_MAINNET]: '0x4FDA0599b78a49d289577a8DF2046459abC04d82',
    [ChainId.ARBITRUM_NOVA]: '0x7B4E28E7273aA8CB64C56fF191ebF43b64f409F9',
    [ChainId.OPTIMISM_MAINNET]: '0x7775b274f0C3fA919B756b22A4d9674e55927ab8',
    [ChainId.TELOS_MAINNET]: '0xf02bBC9de6e443eFDf3FC41851529C2c3B9E5e0C',
    [ChainId.ZKSYNC_MAINNET]: '0x56C343E7cE75e53e58Ed2f3743C6f137c13D2013',
    [ChainId.BOBA_MAINNET]: '0xB79A4F5828eb55c10D7abF4bFe9a9f5d11aA84e0',
    [ChainId.KAVA_MAINNET]: '0xca506793A420E901BbCa8066be5661E3C52c84c2',
    [ChainId.BOBA_BNB]: '0x7e0B73141c8a1AC26B8693e9F34cf42BE17Fea2C',
    [ChainId.TRON_MAINNET]: '0x5112ac3d77551b9f670eb34ef75984246164e38d',
    [ChainId.SCROLL_MAINNET]: '0xf02bBC9de6e443eFDf3FC41851529C2c3B9E5e0C',
    [ChainId.MANTA_MAINNET]: '0xf85FC807D05d3Ab2309364226970aAc57b4e1ea4',
    [ChainId.METIS_MAINNET]: '0x81aB74A9f9d7457fF47dfD102e78A340cF72EC39',
    [ChainId.BAHAMUT_MAINNET]: '0x70A16EB2B39A5573A8138b18582111bBA480fb8F',
    [ChainId.MODE_MAINNET]: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    [ChainId.RSK_MAINNET]: '0x2b7aa8bdc40b6d3d19d0de7480c4db8d5b6495e2',
    [ChainId.BLAST_MAINNET]: '0xf1C374D065719Ce1Fdc63E2c5C13146813c0A83b',
    [ChainId.MERLIN_MAINNET]: '0x1a039cE63AE35a67Bf0E9F6DbFaE969639D59eC8',
    [ChainId.ZKLINK_MAINNET]: '0x9C64162e1614E10f833aFc2a0BdF173324f36Dd5',
    [ChainId.CORE_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.TAIKO_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.SEI_EVM_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.ZETACHAIN_MAINNET]: '0x6148FD6C649866596C3d8a971fC313E5eCE84882',
    [ChainId.CRONOS_MAINNET]: '0x1a039cE63AE35a67Bf0E9F6DbFaE969639D59eC8',
    [ChainId.FRAXTAL_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.GRAVITY_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.BSQUARED_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.CRONOS_ZK_MAINNET]: '0xBf63C7944B1635c79a0f0eE7e07b1702837AD1F9',
    [ChainId.MORPH_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.SONIC_MAINNET]: '0x1cEaeda3D17936916D0F3E866Aa5Ef861F544840',
    [ChainId.ABSTRACT_MAINNET]: '0x9C64162e1614E10f833aFc2a0BdF173324f36Dd5',
    [ChainId.GNOSIS_MAINNET]: '0xf1C374D065719Ce1Fdc63E2c5C13146813c0A83b',
    [ChainId.BERACHAIN_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.UNICHAIN_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.SONEIUM_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.OPBNB_MAINNET]: '0x1cEaeda3D17936916D0F3E866Aa5Ef861F544840',
    [ChainId.HYPERLIQUID_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
}

export function isFeeCollectorSwapSupported(params: SwapExactInParams): boolean {
    const inChainId = params.tokenAmountIn.token.chainId
    const outChainId = params.tokenOut.chainId

    return inChainId === outChainId && FEE_COLLECTOR_ADDRESSES[inChainId] !== undefined
}

export async function feeCollectorSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis } = params

    const inChainId = params.tokenAmountIn.token.chainId

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[inChainId]
    if (!feeCollectorAddress) {
        throw new Error(`Fee collector not found for chain ${inChainId}`)
    }

    const provider = symbiosis.getProvider(inChainId)
    const contract = FeeCollector__factory.connect(feeCollectorAddress, provider)

    const [fee, approveAddress] = await Promise.all([contract.callStatic.fee(), contract.callStatic.onchainGateway()])

    const feeToken = GAS_TOKEN[inChainId]
    const feeTokenAmount = new TokenAmount(feeToken, fee.toString())

    let inTokenAmount = params.tokenAmountIn
    if (inTokenAmount.token.equals(feeToken)) {
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new Error(
                `Amount is too low. Min amount: ${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    // Get onchain swap transaction what will be executed by fee collector
    const result = await onchainSwap({ ...params, tokenAmountIn: inTokenAmount, from: feeCollectorAddress })

    let value: string = ''
    let callData: BytesLike = ''
    let routerAddress: string = ''
    if (result.transactionType === 'tron') {
        value = result.transactionRequest.call_value.toString()
        const method = utils.id(result.transactionRequest.function_selector).slice(0, 10)
        callData = method + result.transactionRequest.raw_parameter
        routerAddress = tronAddressToEvm(result.transactionRequest.contract_address)
    } else if (result.transactionType === 'evm') {
        value = result.transactionRequest.value?.toString() as string
        callData = result.transactionRequest.data as BytesLike
        routerAddress = result.transactionRequest.to as string
    }

    if (inTokenAmount.token.isNative) {
        /**
         * To maintain consistency with any potential fees charged by the aggregator,
         * we calculate the total value by adding the fee to the value obtained from the aggregator.
         */
        value = BigNumber.from(value).add(fee).toString()
    } else {
        value = fee.toString()
    }

    callData = contract.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        routerAddress,
        inTokenAmount.token.isNative ? AddressZero : result.approveTo,
        callData,
    ])

    const functionSelector = getFunctionSelector(contract.interface.getFunction('onswap'))

    const payload = preparePayload({
        functionSelector,
        chainId: inChainId,
        from: params.from,
        to: feeCollectorAddress,
        value,
        callData,
    })

    return {
        ...result,
        ...payload,
        approveTo: approveAddress,
        fees: [
            {
                provider: 'symbiosis',
                value: feeTokenAmount,
                description: 'Symbiosis on-chain fee',
            },
            ...result.fees,
        ],
    }
}

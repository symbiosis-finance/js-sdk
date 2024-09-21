import { BigNumber, BytesLike, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { FEE_COLLECTOR_ADDRESSES, SwapExactInParams } from './swapExactIn'
import { Percent, TokenAmount } from '../entities'
import { BaseSwappingExactInResult } from './baseSwapping'
import { onchainSwap } from './swapExactIn/onchainSwap'
import { tronAddressToEvm } from './tron'
import { getToBtcFee } from './btc'
import { Error, ErrorCode } from './error'
import { FeeCollector__factory, MulticallRouterV2__factory } from './contracts'
import { BTC_NETWORKS, getPkScript } from './zappingBtc'
import { MULTICALL_ROUTER_V2 } from './constants'

export async function zappingBtcOnChain(params: SwapExactInParams): Promise<BaseSwappingExactInResult> {
    const { symbiosis, toAddress, fromAddress } = params

    const chainId = params.inTokenAmount.token.chainId

    const outToken = symbiosis.getRepresentation(params.outToken, chainId)
    if (!outToken) {
        throw new Error(`No representation ${chainId}`)
    }
    if (!outToken.chainFromId) {
        throw new Error('outToken is not synthetic')
    }
    const network = BTC_NETWORKS[outToken.chainFromId]
    if (!network) {
        throw new Error('Unknown BTC network')
    }
    const bitcoinAddress = getPkScript(toAddress, network)

    const provider = symbiosis.getProvider(chainId)

    const multicallRouterAddress = MULTICALL_ROUTER_V2[chainId]
    if (!multicallRouterAddress) {
        throw new Error(`Multicall router v2 not found for chain ${chainId}`)
    }
    const multicallRouter = MulticallRouterV2__factory.connect(multicallRouterAddress, provider)

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[chainId]
    if (!feeCollectorAddress) {
        throw new Error(`Fee collector not found for chain ${chainId}`)
    }

    const feeCollector = FeeCollector__factory.connect(feeCollectorAddress, provider)

    const [fee, approveAddress] = await Promise.all([
        feeCollector.callStatic.fee(),
        feeCollector.callStatic.onchainGateway(),
    ])

    let inTokenAmount = params.inTokenAmount
    if (inTokenAmount.token.isNative) {
        const feeTokenAmount = new TokenAmount(inTokenAmount.token, fee.toString())
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new Error(
                `Amount is too low. Min amount: ${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    // Get onchain swap transaction what will be executed by fee collector
    const result = await onchainSwap({
        ...params,
        outToken,
        fromAddress: multicallRouterAddress,
        toAddress: multicallRouterAddress,
    })

    let value: string
    let swapCallData: BytesLike
    let routerAddress: string
    if (result.transactionType === 'tron') {
        value = result.transactionRequest.call_value.toString()
        const method = utils.id(result.transactionRequest.function_selector).slice(0, 10)
        swapCallData = method + result.transactionRequest.raw_parameter
        routerAddress = tronAddressToEvm(result.transactionRequest.contract_address)
    } else if (result.transactionType === 'evm') {
        value = result.transactionRequest.value?.toString() as string
        swapCallData = result.transactionRequest.data as BytesLike
        routerAddress = result.transactionRequest.to as string
    } else {
        // BTC
        value = ''
        swapCallData = ''
        routerAddress = ''
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

    const synthesis = symbiosis.synthesis(chainId)
    const btcFee = await getToBtcFee(outToken, synthesis, symbiosis.dataProvider)
    const burnCallData = synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
        btcFee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
        '0', // _amount will be patched
        bitcoinAddress, // _to
        outToken.address, // _stoken
        symbiosis.clientId, // _clientID
    ])

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        [swapCallData, burnCallData],
        [routerAddress, synthesis.address],
        [inTokenAmount.token.address, outToken.address],
        [0, 68],
        [inTokenAmount.token.isNative, outToken.isNative],
        fromAddress,
    ])

    const data = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        multicallRouter.address,
        multicallRouter.address, // inTokenAmount.token.isNative ? AddressZero : result.approveTo,
        multicallCalldata,
    ])

    const tokenAmountOut = new TokenAmount(params.outToken, result.tokenAmountOut.subtract(btcFee).raw)
    return {
        save: new TokenAmount(btcFee.token, '0'),
        fee: btcFee,
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut,
        route: result.route,
        priceImpact: result.priceImpact || new Percent('0', '0'),
        amountInUsd: result.amountInUsd || inTokenAmount,
        approveTo: approveAddress,
        type: 'evm',
        transactionRequest: {
            chainId,
            to: feeCollectorAddress,
            data,
            value,
        },
    }
}

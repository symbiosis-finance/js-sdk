import { BigNumber, BytesLike, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { FEE_COLLECTOR_ADDRESSES, SwapExactInParams, SwapExactInResult } from './swapExactIn'
import { Percent, TokenAmount } from '../entities'
import { BaseSwappingExactInResult } from './baseSwapping'
import { onchainSwap } from './swapExactIn/onchainSwap'
import { tronAddressToEvm } from './tron'
import { getToBtcFee } from './btc'
import { Error, ErrorCode } from './error'
import { FeeCollector__factory, MulticallRouterV2__factory } from './contracts'
import { BTC_NETWORKS, getPkScript } from './zappingBtc'
import { MULTICALL_ROUTER_V2 } from './constants'
import { Symbiosis } from './symbiosis'

// TODO extract base function for making multicall swap inside onchain fee collector
export async function zappingBtcOnChain(params: SwapExactInParams): Promise<BaseSwappingExactInResult> {
    const { symbiosis, outToken, toAddress, fromAddress } = params

    const network = BTC_NETWORKS[outToken.chainId]
    if (!network) {
        throw new Error(`Unknown BTC network ${outToken.chainId}`)
    }
    const bitcoinAddress = getPkScript(toAddress, network)

    const chainId = params.inTokenAmount.token.chainId

    const syBTC = symbiosis.getRepresentation(params.outToken, chainId)
    if (!syBTC) {
        throw new Error(`No syBTC found on chain ${chainId}`)
    }
    if (!syBTC.chainFromId) {
        throw new Error('syBTC is not synthetic')
    }

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[chainId]
    if (!feeCollectorAddress) {
        throw new Error(`Fee collector not found for chain ${chainId}`)
    }
    const multicallRouterAddress = MULTICALL_ROUTER_V2[chainId]
    if (!multicallRouterAddress) {
        throw new Error(`MulticallRouterV2 not found for chain ${chainId}`)
    }

    const provider = symbiosis.getProvider(chainId)
    const multicallRouter = MulticallRouterV2__factory.connect(multicallRouterAddress, provider)
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

    const swapCall = await getSwapCall({
        ...params,
        outToken: syBTC,
        fromAddress: multicallRouterAddress,
        toAddress: multicallRouterAddress,
    })

    let value = fee.toString()
    if (swapCall.amountIn.token.isNative) {
        /**
         * To maintain consistency with any potential fees charged by the aggregator,
         * we calculate the total value by adding the fee to the value obtained from the aggregator.
         */
        value = BigNumber.from(swapCall.value).add(fee).toString()
    }

    const burnCall = await getBurnCall(symbiosis, new TokenAmount(syBTC, swapCall.amountOut.raw), bitcoinAddress)

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        [swapCall.data, burnCall.data],
        [swapCall.to, burnCall.to],
        [swapCall.amountIn.token.address, burnCall.amountIn.token.address],
        [swapCall.offset, burnCall.offset],
        [swapCall.amountIn.token.isNative, burnCall.amountIn.token.isNative],
        fromAddress,
    ])

    const data = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        multicallRouter.address,
        multicallRouter.address, // inTokenAmount.token.isNative ? AddressZero : result.approveTo,
        multicallCalldata,
    ])

    const tokenAmountOut = new TokenAmount(outToken, burnCall.amountOut.raw)
    return {
        save: new TokenAmount(swapCall.fee.token, '0'),
        fee: swapCall.fee,
        extraFee: burnCall.fee,
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut,
        route: [syBTC], // TODO build detailed route
        priceImpact: swapCall.priceImpact!,
        amountInUsd: swapCall.amountInUsd!,
        inTradeType: swapCall.inTradeType,
        outTradeType: swapCall.outTradeType,
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

type Call = {
    amountIn: TokenAmount
    amountOut: TokenAmount
    to: string
    data: BytesLike
    value: string
    offset: number
    fee: TokenAmount
}

type SwapCall = Call & SwapExactInResult

async function getSwapCall(params: SwapExactInParams): Promise<SwapCall> {
    // Get onchain swap transaction what will be executed by fee collector
    const result = await onchainSwap(params)

    let value: string
    let data: BytesLike
    let routerAddress: string
    if (result.transactionType === 'tron') {
        value = result.transactionRequest.call_value.toString()
        const method = utils.id(result.transactionRequest.function_selector).slice(0, 10)
        data = method + result.transactionRequest.raw_parameter
        routerAddress = tronAddressToEvm(result.transactionRequest.contract_address)
    } else if (result.transactionType === 'evm') {
        value = result.transactionRequest.value?.toString() as string
        data = result.transactionRequest.data as BytesLike
        routerAddress = result.transactionRequest.to as string
    } else {
        // BTC
        value = ''
        data = ''
        routerAddress = ''
    }

    return {
        ...result,
        fee: result.fee || new TokenAmount(params.outToken, '0'),
        priceImpact: result.priceImpact || new Percent('0', '0'),
        amountInUsd: result.amountInUsd || params.inTokenAmount,
        // Call type params
        amountIn: params.inTokenAmount,
        amountOut: result.tokenAmountOut,
        to: routerAddress,
        data,
        value,
        offset: 0,
    }
}

async function getBurnCall(symbiosis: Symbiosis, amountIn: TokenAmount, bitcoinAddress: Buffer): Promise<Call> {
    const synthesis = symbiosis.synthesis(amountIn.token.chainId)
    const fee = await getToBtcFee(amountIn.token, synthesis, symbiosis.dataProvider)
    const data = synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
        fee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
        '0', // _amount will be patched
        bitcoinAddress, // _to
        amountIn.token.address, // _stoken
        symbiosis.clientId, // _clientID
    ])

    return {
        amountIn,
        amountOut: amountIn.subtract(fee),
        to: synthesis.address,
        data,
        value: '0',
        offset: 68,
        fee,
    }
}

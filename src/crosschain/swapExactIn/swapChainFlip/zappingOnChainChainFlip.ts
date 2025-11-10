import { SwapSDK, VaultSwapResponse } from '@chainflip/sdk/swap'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { BigNumber, BytesLike, utils } from 'ethers'

import { FEE_COLLECTOR_ADDRESSES } from '../feeCollectorSwap'
import { Percent, TokenAmount } from '../../../entities'
import { onchainSwap } from '../onchainSwap'
import { isEvmChainId, tronAddressToEvm } from '../../chainUtils'
import { AmountLessThanFeeError, ChainFlipError, SdkError } from '../../sdkError'
import { FeeCollector__factory, MulticallRouterV2__factory } from '../../contracts'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'

import { ChainFlipBrokerAccount, ChainFlipBrokerFeeBps, checkMinAmount, getChainFlipFee } from './utils'
import { ChainFlipConfig } from './types'

type MulticallItem = {
    data: BytesLike
    to: string
    path: string
    offset: number
    isNative: boolean
}

export async function ZappingOnChainChainFlip(
    params: SwapExactInParams,
    config: ChainFlipConfig
): Promise<SwapExactInResult> {
    const { symbiosis, to, from, tokenAmountIn } = params

    const chainId = params.tokenAmountIn.token.chainId

    let evmTo = from
    if (!isEvmChainId(chainId)) {
        evmTo = symbiosis.config.fallbackReceiver
    }

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[chainId]
    if (!feeCollectorAddress) {
        throw new SdkError(`Fee collector not found for chain ${chainId}`)
    }
    const multicallRouterAddress = MULTICALL_ROUTER_V2[chainId]
    if (!multicallRouterAddress) {
        throw new SdkError(`MulticallRouterV2 not found for chain ${chainId}`)
    }

    const provider = symbiosis.getProvider(chainId)
    const multicallRouter = MulticallRouterV2__factory.connect(multicallRouterAddress, provider)
    const feeCollector = FeeCollector__factory.connect(feeCollectorAddress, provider)

    const [fee, approveAddress] = await symbiosis.cache.get(
        ['feeCollector.fee', 'feeCollector.onchainGateway', chainId.toString()],
        () => {
            return Promise.all([feeCollector.callStatic.fee(), feeCollector.callStatic.onchainGateway()])
        },
        60 * 60 // 1 hour
    )

    let inTokenAmount = params.tokenAmountIn
    if (inTokenAmount.token.isNative) {
        const feeTokenAmount = new TokenAmount(inTokenAmount.token, fee.toString())
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new AmountLessThanFeeError(`Min amount: ${feeTokenAmount.toSignificant()}`)
        }

        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    const multicallItems: MulticallItem[] = []
    let value = fee.toString()
    let depositAmount = tokenAmountIn
    let priceImpact = new Percent('0', BIPS_BASE)

    const fees: FeeItem[] = []
    const routes: RouteItem[] = []
    let swapCall: SwapCall | undefined = undefined
    const swapCallRequired = !tokenAmountIn.token.equals(config.tokenIn)
    if (swapCallRequired) {
        swapCall = await getSwapCall({
            ...params,
            tokenOut: config.tokenIn,
            from: multicallRouterAddress,
            to: multicallRouterAddress,
        })

        if (swapCall.amountIn.token.isNative) {
            /**
             * To maintain consistency with any potential fees charged by the aggregator,
             * we calculate the total value by adding the fee to the value obtained from the aggregator.
             */
            value = BigNumber.from(swapCall.value).add(fee).toString()
        }
        fees.push(...swapCall.fees)
        routes.push(...swapCall.routes)
        priceImpact = swapCall.priceImpact
        depositAmount = swapCall.amountOut
        multicallItems.push({
            data: swapCall.data,
            to: swapCall.to,
            path: swapCall.amountIn.token.isNative ? AddressZero : swapCall.amountIn.token.address,
            offset: swapCall.offset,
            isNative: swapCall.amountIn.token.isNative,
        })
    }

    const depositCall = await getDepositCall({
        amountIn: depositAmount,
        config,
        receiverAddress: to,
        refundAddress: evmTo,
    })
    fees.push(...depositCall.fees)
    routes.push(...depositCall.routes)
    multicallItems.push({
        data: depositCall.data,
        to: depositCall.to,
        path: depositCall.amountIn.token.address,
        offset: depositCall.offset,
        isNative: depositCall.amountIn.token.isNative,
    })

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        multicallItems.map((i) => i.data),
        multicallItems.map((i) => i.to),
        multicallItems.map((i) => i.path),
        multicallItems.map((i) => i.offset),
        multicallItems.map((i) => i.isNative),
        evmTo,
    ])

    const data = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        multicallRouter.address,
        multicallRouter.address,
        multicallCalldata,
    ])

    const tokenAmountOut = depositCall.amountOut
    return {
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut,
        priceImpact: priceImpact,
        amountInUsd: depositAmount,
        approveTo: approveAddress,
        routes,
        fees,
        kind: 'crosschain-swap',
        transactionType: 'evm',
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
    fees: FeeItem[]
    routes: RouteItem[]
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
        priceImpact: result.priceImpact || new Percent('0', BIPS_BASE),
        amountInUsd: result.amountInUsd || params.tokenAmountIn,
        // Call type params
        amountIn: params.tokenAmountIn,
        amountOut: result.tokenAmountOut,
        to: routerAddress,
        data,
        value,
        offset: 0,
    }
}

async function getDepositCall({
    amountIn,
    config,
    receiverAddress,
    refundAddress,
}: {
    amountIn: TokenAmount
    config: ChainFlipConfig
    receiverAddress: string
    refundAddress: string
}): Promise<Call> {
    const { src, dest, tokenOut } = config
    const chainFlipSdk = new SwapSDK({
        network: 'mainnet',
        enabledFeatures: { dca: true },
    })

    checkMinAmount(amountIn)

    let quote
    try {
        const { quotes } = await chainFlipSdk.getQuoteV2({
            amount: amountIn.raw.toString(),
            srcChain: src.chain,
            srcAsset: src.asset,
            destChain: dest.chain,
            destAsset: dest.asset,
            isVaultSwap: true,
            brokerCommissionBps: ChainFlipBrokerFeeBps,
        })
        quote = quotes.find((quote) => quote.type === 'REGULAR')
    } catch (e) {
        throw new ChainFlipError('getQuoteV2 error', [e])
    }

    if (!quote) {
        throw new ChainFlipError('There is no REGULAR quote found')
    }

    let vaultSwapData: VaultSwapResponse
    try {
        vaultSwapData = await chainFlipSdk.encodeVaultSwapData({
            quote,
            destAddress: receiverAddress,
            fillOrKillParams: {
                slippageTolerancePercent: quote.recommendedSlippageTolerancePercent,
                refundAddress,
                retryDurationBlocks: 100,
            },
            brokerAccount: ChainFlipBrokerAccount,
            brokerCommissionBps: ChainFlipBrokerFeeBps,
        })
    } catch (e) {
        throw new ChainFlipError('encodeVaultSwapData error', [e])
    }

    const { chain } = vaultSwapData
    if (chain !== 'Arbitrum' && chain !== 'Ethereum') {
        throw new ChainFlipError(`Incorrect source chain: ${chain}`)
    }
    const { calldata, to } = vaultSwapData

    const { egressAmount } = quote

    const { usdcFeeToken, solFeeToken, btcFeeToken } = getChainFlipFee(quote)

    return {
        amountIn,
        amountOut: new TokenAmount(tokenOut, egressAmount),
        to,
        data: calldata,
        value: '0',
        offset: 164,
        fees: [
            {
                provider: 'chainflip-bridge',
                description: 'ChainFlip fee',
                value: usdcFeeToken,
            },
            {
                provider: 'chainflip-bridge',
                description: 'ChainFlip fee',
                value: solFeeToken,
            },
            {
                provider: 'chainflip-bridge',
                description: 'ChainFlip fee',
                value: btcFeeToken,
            },
        ],
        routes: [
            {
                provider: 'chainflip-bridge',
                tokens: [amountIn.token, tokenOut],
            },
        ],
    }
}

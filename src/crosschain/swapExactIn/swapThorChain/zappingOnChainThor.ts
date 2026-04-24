import { AddressZero } from '@ethersproject/constants'
import type { BytesLike } from 'ethers'
import { BigNumber, utils } from 'ethers'

import type { Token } from '../../../entities'
import { Percent, TokenAmount } from '../../../entities'
import { getFunctionSelector, tronAddressToEvm } from '../../chainUtils/tron'
import { isEvmChainId } from '../../chainUtils'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { FeeCollector__factory, MulticallRouterV2__factory, ThorRouter__factory } from '../../contracts'
import { AmountLessThanFeeError, SdkError, ThorChainError } from '../../sdkError'
import { TradeProvider } from '../../trade'
import type {
    Address,
    EvmAddress,
    FeeItem,
    MulticallV2Item,
    RouteItem,
    SwapExactInParams,
    SwapExactInResult,
} from '../../types'
import { FEE_COLLECTOR_ADDRESSES } from '../feeCollectorSwap'
import { onchainSwap } from '../onchainSwap'
import { preparePayload } from '../preparePayload'

import { BTC, getThorQuote, getThorVault, validateBitcoinAddress } from './utils'

export async function zappingOnChainThor(
    params: SwapExactInParams,
    thorTokenIn: Token,
    thorTokenOut: string
): Promise<SwapExactInResult> {
    const { symbiosis, to, from, tokenAmountIn } = params

    const chainId = tokenAmountIn.token.chainId

    const feeCollectorAddress = FEE_COLLECTOR_ADDRESSES[chainId]
    if (!feeCollectorAddress) {
        throw new SdkError(`Fee collector not found for chain ${chainId}`)
    }

    validateBitcoinAddress(to)

    let evmTo: Address = from
    if (!isEvmChainId(chainId)) {
        evmTo = params.fallbackReceiver ?? symbiosis.config.fallbackReceiver
    }

    const thorVault = await getThorVault(symbiosis.cache, thorTokenIn)

    const provider = symbiosis.getProvider(chainId)
    const feeCollector = FeeCollector__factory.connect(feeCollectorAddress, provider)

    const [fee, approveAddress] = await symbiosis.cache.get(
        ['feeCollector.fee', 'feeCollector.onchainGateway', chainId.toString()],
        () => {
            return Promise.all([feeCollector.callStatic.fee(), feeCollector.callStatic.onchainGateway()])
        },
        60 * 60 // 1 hour
    )

    let inTokenAmount = tokenAmountIn
    if (inTokenAmount.token.isNative) {
        const feeTokenAmount = new TokenAmount(inTokenAmount.token, fee.toString())
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new AmountLessThanFeeError(`Min amount: ${feeTokenAmount.toSignificant()}`)
        }

        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    let value = fee.toString()
    let depositAmount = inTokenAmount
    let priceImpact = new Percent('0', BIPS_BASE)

    const fees: FeeItem[] = []
    const routes: RouteItem[] = []

    // Step 1: on-chain swap if needed (determines depositAmount)
    let swapItem: MulticallV2Item | undefined
    let multicallRouterV2Address: EvmAddress | undefined

    const swapCallRequired = !tokenAmountIn.token.equals(thorTokenIn)
    const minSlippage = 20 // 0.2%
    if (swapCallRequired && params.slippage < minSlippage) {
        throw new ThorChainError('Slippage cannot be less than 0.2% for on-chain ThorChain swap with pre-swap')
    }
    const minOnChainSlippage = 10 // 0.1%
    const onChainSlippage = swapCallRequired ? Math.max(Math.floor(params.slippage * 0.4), minOnChainSlippage) : 0
    const thorSlippage = swapCallRequired ? params.slippage - onChainSlippage : params.slippage

    if (swapCallRequired) {
        multicallRouterV2Address = MULTICALL_ROUTER_V2[chainId]
        if (!multicallRouterV2Address) {
            throw new SdkError(`MulticallRouterV2 not found for chain ${chainId}`)
        }

        const swapResult = await onchainSwap({
            ...params,
            slippage: onChainSlippage,
            tokenAmountIn: inTokenAmount,
            tokenOut: thorTokenIn,
            from: multicallRouterV2Address,
            to: multicallRouterV2Address,
        })

        let swapData: BytesLike
        let swapTo: string
        let swapValue = '0'

        if (swapResult.transactionType === 'evm') {
            swapData = swapResult.transactionRequest.data as BytesLike
            swapTo = swapResult.transactionRequest.to as string
            swapValue = swapResult.transactionRequest.value?.toString() || '0'
        } else if (swapResult.transactionType === 'tron') {
            const { function_selector, raw_parameter, contract_address, call_value } = swapResult.transactionRequest
            swapData = utils.id(function_selector).slice(0, 10) + raw_parameter
            swapTo = tronAddressToEvm(contract_address)
            swapValue = call_value?.toString() || '0'
        } else {
            throw new ThorChainError('Unexpected transaction type')
        }

        if (tokenAmountIn.token.isNative) {
            value = BigNumber.from(swapValue).add(fee).toString()
        }

        fees.push(...swapResult.fees)
        routes.push(...swapResult.routes)
        priceImpact = swapResult.priceImpact
        depositAmount = swapResult.tokenAmountOut

        swapItem = {
            data: swapData,
            to: swapTo,
            path: tokenAmountIn.token.isNative ? AddressZero : tokenAmountIn.token.address,
            offset: 0,
            isNative: tokenAmountIn.token.isNative,
        }
    }

    // Step 2: get ThorChain quote
    const thorQuote = await getThorQuote({
        thorTokenIn,
        thorTokenOut,
        evmTo,
        bitcoinAddress: to,
        amount: depositAmount,
        slippage: thorSlippage,
    })

    fees.push({
        provider: TradeProvider.THORCHAIN_BRIDGE,
        description: 'THORChain fee',
        value: new TokenAmount(BTC, thorQuote.fees.total),
    })
    routes.push({
        provider: TradeProvider.THORCHAIN_BRIDGE,
        tokens: [thorTokenIn, BTC],
    })

    // Step 3: build calldata
    let onswapCalldata: string
    let onswapRouterAddress: string
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 // + 1h

    if (swapItem && multicallRouterV2Address) {
        // Swap + deposit via MulticallRouterV2
        const multicallRouterV2 = MulticallRouterV2__factory.connect(multicallRouterV2Address, provider)

        const depositItem: MulticallV2Item = {
            data: ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
                thorVault,
                thorTokenIn.address,
                '0', // will be patched by MulticallRouter
                thorQuote.memo,
                expiry,
            ]),
            to: thorQuote.router,
            path: thorTokenIn.address,
            offset: 100,
            isNative: false,
        }

        const multicallItems = [swapItem, depositItem]

        onswapCalldata = multicallRouterV2.interface.encodeFunctionData('multicall', [
            inTokenAmount.raw.toString(),
            multicallItems.map((i) => i.data),
            multicallItems.map((i) => i.to),
            multicallItems.map((i) => i.path),
            multicallItems.map((i) => i.offset),
            multicallItems.map((i) => i.isNative),
            evmTo,
        ])
        onswapRouterAddress = multicallRouterV2.address
    } else {
        // Direct deposit via ThorRouter
        onswapCalldata = ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
            thorVault,
            thorTokenIn.address,
            inTokenAmount.raw.toString(),
            thorQuote.memo,
            expiry,
        ])
        onswapRouterAddress = thorQuote.router
    }

    // Step 4: wrap in FeeCollector and prepare payload
    const callData = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        onswapRouterAddress,
        onswapRouterAddress,
        onswapCalldata,
    ])

    const functionSelector = getFunctionSelector(feeCollector.interface.getFunction('onswap'))

    const payload = preparePayload({
        functionSelector,
        chainId,
        from,
        to: feeCollectorAddress,
        value,
        callData,
    })

    return {
        tokenAmountOut: new TokenAmount(BTC, thorQuote.expected_amount_out),
        tokenAmountOutMin: new TokenAmount(BTC, thorQuote.amount_out_min),
        priceImpact,
        amountInUsd: depositAmount,
        approveTo: approveAddress,
        labels: ['partner-swap'],
        routes,
        fees,
        operationType: 'crosschain-swap',
        ...payload,
    }
}

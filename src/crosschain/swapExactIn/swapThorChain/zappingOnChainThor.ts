import { AddressZero } from '@ethersproject/constants'
import type { BytesLike } from 'ethers'
import { BigNumber } from 'ethers'

import type { Token } from '../../../entities'
import { Percent, TokenAmount } from '../../../entities'
import { isEvmChainId } from '../../chainUtils'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { FeeCollector__factory, MulticallRouterV2__factory, ThorRouter__factory } from '../../contracts'
import { AmountLessThanFeeError, SdkError, ThorChainError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade'
import type { Address, FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'
import { FEE_COLLECTOR_ADDRESSES } from '../feeCollectorSwap'
import { onchainSwap } from '../onchainSwap'

import { BTC, checkThorPool, getThorQuote, getThorVault, validateBitcoinAddress } from './utils'

type MulticallItem = {
    data: BytesLike
    to: string
    path: string
    offset: number
    isNative: boolean
}

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
    const multicallRouterV2Address = MULTICALL_ROUTER_V2[chainId]
    if (!multicallRouterV2Address) {
        throw new SdkError(`MulticallRouterV2 not found for chain ${chainId}`)
    }

    validateBitcoinAddress(to)

    let evmTo: Address = from
    if (!isEvmChainId(chainId)) {
        evmTo = params.fallbackReceiver ?? symbiosis.config.fallbackReceiver
    }

    // Check ThorChain pool availability
    await checkThorPool(symbiosis.cache, thorTokenIn)

    // Get ThorChain vault
    const thorVault = await getThorVault(symbiosis.cache, thorTokenIn)

    const provider = symbiosis.getProvider(chainId)
    const multicallRouterV2 = MulticallRouterV2__factory.connect(multicallRouterV2Address, provider)
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

    const multicallItems: MulticallItem[] = []
    let value = fee.toString()
    let depositAmount = inTokenAmount
    let priceImpact = new Percent('0', BIPS_BASE)

    const fees: FeeItem[] = []
    const routes: RouteItem[] = []

    const swapCallRequired = !tokenAmountIn.token.equals(thorTokenIn)
    if (swapCallRequired) {
        const swapResult = await onchainSwap({
            ...params,
            tokenOut: thorTokenIn,
            from: multicallRouterV2Address as Address,
            to: multicallRouterV2Address as Address,
        })

        if (swapResult.transactionType !== 'evm') {
            throw new ThorChainError('Unexpected transaction type')
        }

        if (tokenAmountIn.token.isNative) {
            value = BigNumber.from(swapResult.transactionRequest.value?.toString() || '0')
                .add(fee)
                .toString()
        }

        fees.push(...swapResult.fees)
        routes.push(...swapResult.routes)
        priceImpact = swapResult.priceImpact
        depositAmount = swapResult.tokenAmountOut

        multicallItems.push({
            data: swapResult.transactionRequest.data as BytesLike,
            to: swapResult.transactionRequest.to as string,
            path: tokenAmountIn.token.isNative ? AddressZero : tokenAmountIn.token.address,
            offset: 0,
            isNative: tokenAmountIn.token.isNative,
        })
    }

    // Get ThorChain quote
    const thorQuote = await getThorQuote({
        thorTokenIn: thorTokenIn,
        thorTokenOut,
        evmTo,
        bitcoinAddress: to,
        amount: depositAmount,
    })

    // Build deposit calldata
    const expiry = Math.floor(Date.now() / 1000) + 60 * 60 // + 1h
    const depositCalldata = ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
        thorVault,
        thorTokenIn.address,
        '0', // will be patched by MulticallRouter
        thorQuote.memo,
        expiry,
    ])

    multicallItems.push({
        data: depositCalldata,
        to: thorQuote.router,
        path: thorTokenIn.address,
        offset: 100,
        isNative: false,
    })

    const multicallData = multicallRouterV2.interface.encodeFunctionData('multicall', [
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
        multicallRouterV2.address,
        multicallRouterV2.address,
        multicallData,
    ])

    fees.push({
        provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
        description: 'THORChain fee',
        value: new TokenAmount(BTC, thorQuote.fees.total),
    })

    routes.push({
        provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
        tokens: [thorTokenIn, BTC],
    })

    return {
        tokenAmountOut: thorQuote.amountOut,
        tokenAmountOutMin: thorQuote.amountOutMin,
        priceImpact,
        amountInUsd: depositAmount,
        approveTo: approveAddress,
        labels: ['partner-swap'],
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

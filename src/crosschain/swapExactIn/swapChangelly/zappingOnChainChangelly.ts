import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import type { BytesLike } from 'ethers'
import { BigNumber, utils } from 'ethers'

import { Percent, TokenAmount } from '../../../entities'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { FeeCollector__factory, MulticallRouterV2__factory } from '../../contracts'
import { AmountLessThanFeeError, ChangellyError, SdkError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade'
import type { Address, FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'
import { isTronChainId, tronAddressToEvm } from '../../chainUtils'
import TronWeb from 'tronweb'
import { FEE_COLLECTOR_ADDRESSES } from '../feeCollectorSwap'
import { onchainSwap } from '../onchainSwap'
import { preparePayload } from '../preparePayload'

import { getChangellyTransitToken } from './constants'
import { createChangellyDeposit, getChangellyEstimate } from './changellyTrade'

const erc20Interface = new Interface(['function transfer(address to, uint256 amount)'])
const ERC20_TRANSFER_AMOUNT_OFFSET = 68 // 32 (memory length word) + 4 (selector) + 32 (address param)

export function isChangellyZappingSupported(params: SwapExactInParams): boolean {
    if (params.disabledProviders?.includes(SymbiosisTradeType.CHANGELLY)) return false

    const fromChainId = params.tokenAmountIn.token.chainId

    if (!FEE_COLLECTOR_ADDRESSES[fromChainId]) return false
    if (!MULTICALL_ROUTER_V2[fromChainId]) return false

    return !!getChangellyTransitToken(fromChainId)
}

export async function changellyZappingSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = params
    const chainId = tokenAmountIn.token.chainId

    // 1. Select a transit token (always ERC-20, never native)
    const transit = getChangellyTransitToken(chainId)
    if (!transit) {
        throw new ChangellyError(`No transit tokens for chain ${chainId}`)
    }
    const { token: transitToken } = transit

    // 2. Resolve infrastructure
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
        () => Promise.all([feeCollector.callStatic.fee(), feeCollector.callStatic.onchainGateway()]),
        60 * 60
    )

    // 3. Deduct fee from native input
    let inTokenAmount = tokenAmountIn
    if (inTokenAmount.token.isNative) {
        const feeTokenAmount = new TokenAmount(inTokenAmount.token, fee.toString())
        if (inTokenAmount.lessThan(feeTokenAmount) || inTokenAmount.equalTo(feeTokenAmount)) {
            throw new AmountLessThanFeeError(`Min amount: ${feeTokenAmount.toSignificant()}`)
        }
        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    // 4. On-chain swap: input token → transit token
    const swapResult = await onchainSwap({
        ...params,
        tokenAmountIn: inTokenAmount,
        tokenOut: transitToken,
        from: multicallRouterAddress as Address,
        to: multicallRouterAddress as Address,
    })

    if (swapResult.transactionType !== 'evm' && swapResult.transactionType !== 'tron') {
        throw new ChangellyError(`Unsupported swap transaction type: ${swapResult.transactionType}`)
    }
    let swapData: BytesLike
    let swapTo: string
    let swapNativeValue: BigNumber
    // TRON: currently unreachable — MULTICALL_ROUTER_V2 has no TRON entry so isChangellyZappingSupported
    // returns false for TRON. This branch is ready for when MulticallRouterV2 is deployed on TRON.
    if (swapResult.transactionType === 'tron') {
        swapNativeValue = BigNumber.from(swapResult.transactionRequest.call_value || 0)
        const method = utils.id(swapResult.transactionRequest.function_selector).slice(0, 10)
        swapData = method + swapResult.transactionRequest.raw_parameter
        swapTo = tronAddressToEvm(swapResult.transactionRequest.contract_address)
    } else {
        swapNativeValue = BigNumber.from(swapResult.transactionRequest.value || 0)
        swapData = swapResult.transactionRequest.data as BytesLike
        swapTo = swapResult.transactionRequest.to as string
    }

    const transitAmount = swapResult.tokenAmountOut

    // 5. Changelly estimate: transit token → destination
    const changellyEstimate = await getChangellyEstimate(symbiosis, transitAmount, tokenOut)

    // 6. Build routes and fees
    const routes: RouteItem[] = [
        ...swapResult.routes,
        {
            provider: SymbiosisTradeType.CHANGELLY,
            tokens: [transitToken, changellyEstimate.tokenOutResolved],
        },
    ]
    const fees: FeeItem[] = [...swapResult.fees, ...changellyEstimate.fees]
    const priceImpact = swapResult.priceImpact || new Percent('0', BIPS_BASE)

    // 7. Create Changelly deposit
    // params.from / params.to are converted to EVM hex for TRON at swapExactIn entry — convert back for Changelly
    const refundFallback = isTronChainId(chainId) ? TronWeb.address.fromHex(params.from) : params.from
    const payoutAddress = isTronChainId(tokenOut.chainId) ? TronWeb.address.fromHex(params.to) : params.to
    const changellyData = await createChangellyDeposit(symbiosis, {
        currencyFrom: changellyEstimate.currencyFrom,
        currencyTo: changellyEstimate.currencyTo,
        amountFrom: changellyEstimate.amountFrom,
        rateId: changellyEstimate.rateId,
        address: payoutAddress,
        refundAddress: params.refundAddress || refundFallback,
        extraIdTo: params.changellyExtraIdTo,
    })

    // For TRON: deposit address is base58 — convert to EVM hex for ABI encoding (TVM is ABI-compatible)
    const isTron = isTronChainId(chainId)
    const depositAddressForAbi = isTron ? tronAddressToEvm(changellyData.depositAddress) : changellyData.depositAddress
    const senderForAbi = isTron ? tronAddressToEvm(params.from) : params.from

    // 9. Build multicall items
    // Item 1: DEX swap
    const swapItem: MulticallItem = {
        data: swapData,
        to: swapTo,
        path: inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        offset: 0,
        isNative: inTokenAmount.token.isNative,
    }

    // Item 2: ERC-20 transfer to Changelly deposit address
    const transferData = erc20Interface.encodeFunctionData('transfer', [
        depositAddressForAbi,
        transitAmount.raw.toString(),
    ])
    const transferItem: MulticallItem = {
        data: transferData,
        to: transitToken.address,
        path: transitToken.address,
        offset: ERC20_TRANSFER_AMOUNT_OFFSET,
        isNative: false,
    }

    const multicallItems = [swapItem, transferItem]

    // 10. Encode multicall
    // For native input, inTokenAmount is already fee-deducted — the router pulls exactly this much.
    // For ERC-20 input, inTokenAmount equals tokenAmountIn (no deduction).
    const value = inTokenAmount.token.isNative ? swapNativeValue.add(fee).toString() : fee.toString()

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        multicallItems.map((i) => i.data),
        multicallItems.map((i) => i.to),
        multicallItems.map((i) => i.path),
        multicallItems.map((i) => i.offset),
        multicallItems.map((i) => i.isNative),
        senderForAbi,
    ])

    // 11. Wrap in FeeCollector.onswap
    const data = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        multicallRouterAddress,
        multicallRouterAddress,
        multicallCalldata,
    ])

    return {
        tokenAmountOut: changellyEstimate.tokenAmountOut,
        tokenAmountOutMin: changellyEstimate.tokenAmountOut,
        priceImpact,
        approveTo: approveAddress,
        routes,
        fees,
        labels: ['partner-swap'],
        kind: 'changelly-trade',
        changellyData,
        ...preparePayload({
            chainId,
            from: senderForAbi,
            to: feeCollectorAddress,
            callData: data,
            value,
            functionSelector: 'onswap(address,uint256,address,address,bytes)',
        }),
    }
}

type MulticallItem = {
    data: BytesLike
    to: string
    path: string
    offset: number
    isNative: boolean
}

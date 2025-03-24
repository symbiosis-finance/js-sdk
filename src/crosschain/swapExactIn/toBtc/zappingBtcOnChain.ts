import { BigNumber, BytesLike, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ZERO_FEE_COLLECTOR_ADDRESSES } from '../../swapExactIn'
import { Percent, Token, TokenAmount } from '../../../entities'
import { onchainSwap } from '../onchainSwap'
import { tronAddressToEvm } from '../../chainUtils'
import { BTC_NETWORKS, getPkScript, getToBtcFee } from '../../chainUtils/btc'
import { Error, ErrorCode } from '../../error'
import { FeeCollector__factory, MulticallRouterV2__factory, PartnerFeeCollector__factory } from '../../contracts'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { Symbiosis } from '../../symbiosis'
import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'

// TODO extract base function for making multicall swap inside onchain fee collector
export async function zappingBtcOnChain(params: SwapExactInParams, syBtc: Token): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut, to, from, partnerAddress } = params

    const network = BTC_NETWORKS[tokenOut.chainId]
    if (!network) {
        throw new Error(`Unknown BTC network ${tokenOut.chainId}`)
    }
    const bitcoinAddress = getPkScript(to, network)

    const chainId = tokenAmountIn.token.chainId

    const feeCollectorAddress = ZERO_FEE_COLLECTOR_ADDRESSES[chainId]
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
            throw new Error(
                `Amount is too low. Min amount: ${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        inTokenAmount = inTokenAmount.subtract(feeTokenAmount)
    }

    const swapCall = await getSwapCall({
        ...params,
        tokenOut: syBtc,
        from: multicallRouterAddress,
        to: multicallRouterAddress,
    })

    let value = fee.toString()
    if (swapCall.amountIn.token.isNative) {
        /**
         * To maintain consistency with any potential fees charged by the aggregator,
         * we calculate the total value by adding the fee to the value obtained from the aggregator.
         */
        value = BigNumber.from(swapCall.value).add(fee).toString()
    }

    const calls: Call[] = [swapCall]

    let burnCallAmountIn = new TokenAmount(syBtc, swapCall.amountOut.raw)

    const partnerFeeCall = await getPartnerFeeCall({
        symbiosis,
        amountIn: new TokenAmount(syBtc, swapCall.amountOut.raw),
        partnerAddress,
    })

    if (partnerFeeCall) {
        calls.push(partnerFeeCall)
        burnCallAmountIn = new TokenAmount(syBtc, partnerFeeCall.amountOut.raw)
    }

    const burnCall = await getBurnCall({
        symbiosis,
        amountIn: burnCallAmountIn,
        tokenOut,
        bitcoinAddress,
    })
    calls.push(burnCall)

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        [...calls.map((i) => i.data)],
        [...calls.map((i) => i.to)],
        [...calls.map((i) => (i.amountIn.token.isNative ? AddressZero : i.amountIn.token.address))],
        [...calls.map((i) => i.offset)],
        [...calls.map((i) => i.amountIn.token.isNative)],
        from,
    ])

    const data = feeCollector.interface.encodeFunctionData('onswap', [
        inTokenAmount.token.isNative ? AddressZero : inTokenAmount.token.address,
        inTokenAmount.raw.toString(),
        multicallRouter.address,
        multicallRouter.address, // inTokenAmount.token.isNative ? AddressZero : result.approveTo,
        multicallCalldata,
    ])

    const tokenAmountOut = burnCall.amountOut
    return {
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut,
        priceImpact: swapCall.priceImpact!,
        amountInUsd: swapCall.amountInUsd!,
        approveTo: approveAddress,
        routes: [...swapCall.routes, ...burnCall.routes],
        fees: [...swapCall.fees, ...burnCall.fees],
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
        throw new Error('Swap call is possible on EVM or Tron chains')
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

async function getPartnerFeeCall({
    symbiosis,
    amountIn,
    partnerAddress,
}: {
    symbiosis: Symbiosis
    amountIn: TokenAmount
    partnerAddress?: string
}): Promise<Call | undefined> {
    const token = amountIn.token
    const { chainId } = token
    const partnerFeeCollectorAddress = symbiosis.chainConfig(chainId).partnerFeeCollector
    if (!partnerFeeCollectorAddress || !partnerAddress) {
        return
    }
    const partnerFeeCollector = PartnerFeeCollector__factory.connect(
        partnerFeeCollectorAddress,
        symbiosis.getProvider(chainId)
    )
    const WAD = BigNumber.from(10).pow(18)
    const { isActive, feeRate } = await symbiosis.cache.get(
        ['partnerFeeCollector', partnerFeeCollectorAddress, chainId.toString(), partnerAddress],
        () => partnerFeeCollector.callStatic.partners(partnerAddress),
        60 * 60 // 1 hour
    )
    if (!isActive || feeRate.isZero()) {
        return
    }
    const fixedFee = await symbiosis.cache.get(
        ['partnerFeeCollector', partnerFeeCollectorAddress, chainId.toString(), partnerAddress, token.address],
        () => partnerFeeCollector.callStatic.stableFees(partnerAddress, token.address),
        60 * 60 // 1 hour
    )

    const amountInBn = BigNumber.from(amountIn.raw.toString())
    const percentageFee = amountInBn.mul(feeRate).div(WAD)
    const totalFee = percentageFee.add(fixedFee)

    const fee = new TokenAmount(amountIn.token, totalFee.toString())
    const amountOut = new TokenAmount(amountIn.token, amountInBn.sub(totalFee).toString())

    const data = partnerFeeCollector.interface.encodeFunctionData('collectFee', [
        amountIn.raw.toString(),
        amountIn.token.address,
        partnerAddress,
    ])

    return {
        amountIn,
        amountOut,
        to: partnerFeeCollectorAddress,
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

async function getBurnCall({
    symbiosis,
    amountIn,
    tokenOut,
    bitcoinAddress,
}: {
    symbiosis: Symbiosis
    amountIn: TokenAmount
    tokenOut: Token
    bitcoinAddress: Buffer
}): Promise<Call> {
    const synthesis = symbiosis.synthesis(amountIn.token.chainId)
    const fee = await getToBtcFee(amountIn, synthesis, symbiosis.cache)
    const data = synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
        fee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
        '0', // _amount will be patched
        bitcoinAddress, // _to
        amountIn.token.address, // _stoken
        symbiosis.clientId, // _clientID
    ])

    return {
        amountIn,
        amountOut: new TokenAmount(tokenOut, amountIn.subtract(fee).raw),
        to: synthesis.address,
        data,
        value: '0',
        offset: 68,
        fees: [
            {
                provider: 'symbiosis',
                description: 'Burn fee',
                value: fee,
            },
        ],
        routes: [
            {
                provider: 'symbiosis',
                tokens: [amountIn.token, tokenOut],
            },
        ],
    }
}

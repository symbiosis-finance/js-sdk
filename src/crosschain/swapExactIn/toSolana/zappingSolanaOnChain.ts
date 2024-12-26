import { BigNumber, BytesLike, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { FEE_COLLECTOR_ADDRESSES } from '../../swapExactIn'
import { Percent, TokenAmount } from '../../../entities'
import { onchainSwap } from '../onchainSwap'
import { tronAddressToEvm } from '../../chainUtils'
import { Error, ErrorCode } from '../../error'
import { ChainFlipVault__factory, FeeCollector__factory, MulticallRouterV2__factory } from '../../contracts'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'
import { ChainFlipConfig } from '../../swapping/zappingChainFlip'
import { SwapSDK } from '@chainflip/sdk/swap'
import { Address, getAddressEncoder } from '@solana/addresses'

type MulticallItem = {
    data: BytesLike
    to: string
    path: string
    offset: number
    isNative: boolean
}

export async function zappingSolanaOnChain(
    params: SwapExactInParams,
    config: ChainFlipConfig
): Promise<SwapExactInResult> {
    const { symbiosis, to, from, tokenAmountIn } = params

    const chainId = params.tokenAmountIn.token.chainId

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
            throw new Error(
                `Amount is too low. Min amount: ${feeTokenAmount.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
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
        solanaAddress: to,
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
        from,
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
    solanaAddress,
}: {
    amountIn: TokenAmount
    config: ChainFlipConfig
    solanaAddress: string
}): Promise<Call> {
    // get quote

    const { src, dest, tokenIn, vaultAddress, tokenOut } = config
    const chainFlipSdk = new SwapSDK({
        network: 'mainnet',
    })

    const quoteResponse = await chainFlipSdk.getQuote({
        amount: amountIn.raw.toString(),
        srcChain: src.chain,
        srcAsset: src.asset,
        destChain: dest.chain,
        destAsset: dest.asset,
    })
    const encoder = getAddressEncoder()
    const dstAddress = encoder.encode(solanaAddress as Address)
    const data = ChainFlipVault__factory.createInterface().encodeFunctionData('xSwapToken', [
        dest.chainId, // dstChain
        dstAddress, // dstAddress
        dest.assetId, // dstToken
        tokenIn.address, // srcToken (Arbitrum.USDC address)
        BigNumber.from(0), // amount (will be patched)
        [], //cfParameters
    ])

    return {
        amountIn,
        amountOut: new TokenAmount(tokenOut, quoteResponse.quote.egressAmount),
        to: vaultAddress,
        data,
        value: '0',
        offset: 164,
        fees: [],
        routes: [
            {
                provider: 'symbiosis',
                tokens: [amountIn.token, tokenOut],
            },
        ],
    }
}

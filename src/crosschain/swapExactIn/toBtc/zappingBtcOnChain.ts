import { BigNumber, BytesLike, utils } from 'ethers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ZERO_FEE_COLLECTOR_ADDRESSES } from '../../swapExactIn'
import { Percent, Token, TokenAmount } from '../../../entities'
import { onchainSwap } from '../onchainSwap'
import { tronAddressToEvm } from '../../chainUtils'
import { getToBtcFee } from '../../chainUtils/btc'
import { Error, ErrorCode } from '../../error'
import { FeeCollector__factory, MulticallRouterV2__factory } from '../../contracts'
import { BTC_NETWORKS, getPkScript } from '../../swapping/zappingBtc'
import { BIPS_BASE, MULTICALL_ROUTER_V2 } from '../../constants'
import { Symbiosis } from '../../symbiosis'
import { FeeItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../../types'

// TODO extract base function for making multicall swap inside onchain fee collector
export async function zappingBtcOnChain(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenOut, to, from } = params

    const network = BTC_NETWORKS[tokenOut.chainId]
    if (!network) {
        throw new Error(`Unknown BTC network ${tokenOut.chainId}`)
    }
    const bitcoinAddress = getPkScript(to, network)

    const chainId = params.tokenAmountIn.token.chainId

    const syBTC = symbiosis.getRepresentation(params.tokenOut, chainId)
    if (!syBTC) {
        throw new Error(`No syBTC found on chain ${chainId}`)
    }
    if (!syBTC.chainFromId) {
        throw new Error('syBTC is not synthetic')
    }

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

    const [fee, approveAddress] = await symbiosis.dataProvider.get(
        ['feeCollector.fee', 'feeCollector.onchainGateway'],
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

    const swapCall = await getSwapCall({
        ...params,
        tokenOut: syBTC,
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

    const burnCall = await getBurnCall({
        symbiosis,
        amountIn: new TokenAmount(syBTC, swapCall.amountOut.raw),
        tokenOut,
        bitcoinAddress,
    })

    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        inTokenAmount.raw.toString(),
        [swapCall.data, burnCall.data],
        [swapCall.to, burnCall.to],
        [
            swapCall.amountIn.token.isNative ? AddressZero : swapCall.amountIn.token.address,
            burnCall.amountIn.token.address,
        ],
        [swapCall.offset, burnCall.offset],
        [swapCall.amountIn.token.isNative, burnCall.amountIn.token.isNative],
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
    const fee = await getToBtcFee(amountIn, synthesis, symbiosis.dataProvider)
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

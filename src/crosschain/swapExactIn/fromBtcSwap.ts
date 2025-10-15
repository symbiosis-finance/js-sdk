import { TransactionRequest } from '@ethersproject/providers'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { BigNumber, BigNumberish } from 'ethers'
import { BytesLike, isAddress } from 'ethers/lib/utils'

import { BtcConfig, FeeItem, MultiCallItem, RouteItem, SwapExactInParams, SwapExactInResult } from '../types'
import { Fraction, Percent, TokenAmount } from '../../entities'

import { Error, ErrorCode } from '../error'
import { getPkScript, isBtcChainId, isEvmChainId, isTronChainId } from '../chainUtils'
import { ERC20__factory, MetaRouter__factory, SymBtc__factory } from '../contracts'
import { MetaRouteStructs } from '../contracts/MetaRouter'
import { Cache } from '../cache'
import { getFastestFee } from '../mempool'
import { AggregatorTrade } from '../trade'
import { theBest } from './utils'
import { ChainId } from '../../constants'
import { bestPoolSwapping } from './crosschainSwap/bestPoolSwapping'
import { BIPS_BASE } from '../constants'
import { getPartnerFeeCall } from '../feeCall/getPartnerFeeCall'
import { getVolumeFeeCall } from '../feeCall/getVolumeFeeCall'
import { validate } from 'bitcoin-address-validation'
import { isUseOneInchOnly } from '../utils'
import { randomBytes } from 'crypto'
import { DepositoryContracts } from '../symbiosis'

export function isFromBtcSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, symbiosis } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(tokenAmountIn)

    return true
}

export async function fromBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, selectMode, symbiosis } = context

    if (!isBtcChainId(tokenAmountIn.token.chainId)) {
        throw new Error(`tokenAmountIn is not BTC token`)
    }

    const promises: Promise<SwapExactInResult>[] = []

    // configs except syBTC on zksync
    const allConfigs = symbiosis.config.btcConfigs.filter((i) => i.symBtc.chainId !== ChainId.ZKSYNC_MAINNET)
    // prefer to use destination chain syBTC to avoid cross-chain routing
    const chainOutConfigs = allConfigs.filter((i) => i.symBtc.chainId === tokenOut.chainId)
    const configs = chainOutConfigs.length > 0 ? chainOutConfigs : allConfigs
    configs.forEach((btcConfig) => {
        promises.push(fromBtcSwapInternal(context, btcConfig))
    })

    return theBest(promises, selectMode)
}

async function fromBtcSwapInternal(context: SwapExactInParams, btcConfig: BtcConfig): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, symbiosis, to, refundAddress, generateBtcDepositAddress } = context

    const { btc, symBtc, forwarderUrl } = btcConfig

    const syBtcSynth = symbiosis.getRepresentation(btc, symBtc.chainId)
    if (!syBtcSynth) {
        throw new Error(`syBTC as synth wasn't found`)
    }
    const syBtc = symbiosis.tokens().find((token) => token.equals(syBtcSynth) && !token.isSynthetic)
    if (!syBtc) {
        throw new Error(`syBTC as original wasn't found`)
    }

    if (!isEvmChainId(tokenOut.chainId) && !isTronChainId(tokenOut.chainId)) {
        throw new Error(`Only EVM chains are allowed to swap from BTC`)
    }

    if (!isAddress(to)) {
        throw new Error(`Incorrect destination address was provided`)
    }

    if (refundAddress && !validate(refundAddress)) {
        throw new Error(`Incorrect refund address was provided`)
    }

    const btcAmountRaw = tokenAmountIn.raw.toString()
    let syBtcAmount = new TokenAmount(syBtc, btcAmountRaw)

    const fees: FeeItem[] = []

    // >> PORTAL FEE
    const btcPortalFeeRaw = await getBtcPortalFee(forwarderUrl, symbiosis.cache)
    const btcPortalFee = new TokenAmount(syBtc, btcPortalFeeRaw)
    if (syBtcAmount.lessThan(btcPortalFee)) {
        throw new Error(
            `Amount ${syBtcAmount.toSignificant()} ${
                syBtcAmount.token.symbol
            } less than btcPortalFee ${btcPortalFee.toSignificant()} ${btcPortalFee.token.symbol}`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    syBtcAmount = syBtcAmount.subtract(btcPortalFee)
    fees.push({
        provider: 'symbiosis',
        description: 'BTC Portal fee',
        value: new TokenAmount(btc, btcPortalFee.raw),
    })

    // >> MINT FEE
    const mintFeeRaw = '1000' // satoshi
    const mintFee = new TokenAmount(syBtc, mintFeeRaw.toString())
    if (syBtcAmount.lessThan(mintFee)) {
        throw new Error(
            `Amount ${syBtcAmount.toSignificant()} ${
                syBtcAmount.token.symbol
            } less than mintFee ${mintFee.toSignificant()} ${mintFee.token.symbol}`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    syBtcAmount = syBtcAmount.subtract(mintFee)
    fees.push({
        provider: 'symbiosis',
        description: 'Mint fee',
        value: mintFee,
    })

    const { tail: initialTail } = await buildTail(context, btcConfig, syBtcAmount)

    const btcForwarderFeeRaw = await estimateWrap({
        forwarderUrl,
        portalFee: btcPortalFeeRaw,
        stableBridgingFee: mintFeeRaw,
        tail: initialTail,
        to,
        amount: btcAmountRaw,
        refundAddress,
        clientId: symbiosis.clientId,
    })
    const btcForwarderFeeMax = new TokenAmount(
        syBtc,
        btcForwarderFeeRaw.mul(200).div(100).toString() // +100% of fee
    )
    if (syBtcAmount.lessThan(btcForwarderFeeMax)) {
        throw new Error(
            `Amount ${syBtcAmount.toSignificant()} less than btcForwarderFeeMax ${btcForwarderFeeMax.toSignificant()}`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    syBtcAmount = syBtcAmount.subtract(btcForwarderFeeMax)
    fees.push({
        provider: 'symbiosis',
        description: 'BTC Forwarder fee',
        value: new TokenAmount(btc, btcForwarderFeeMax.raw),
    })

    symbiosis.context?.logger.info('Should be minted not less than', `${syBtcAmount.toSignificant()} syBTC`)

    // >> TODO patch amounts instead calling quote again
    const {
        tail,
        fees: swapFees,
        amountOut,
        amountOutMin,
        priceImpact,
        routes,
    } = await buildTail(context, btcConfig, syBtcAmount)
    fees.push(...swapFees)
    // <<

    let validUntil = ''
    let revealAddress = ''
    if (generateBtcDepositAddress) {
        const wrapResponse = await wrap({
            forwarderUrl,
            portalFee: btcPortalFeeRaw,
            stableBridgingFee: mintFeeRaw,
            tail,
            to,
            feeLimit: btcForwarderFeeMax.raw.toString(),
            amount: btcAmountRaw,
            refundAddress,
            clientId: symbiosis.clientId,
        })
        validUntil = wrapResponse.validUntil
        revealAddress = wrapResponse.revealAddress
    }

    return {
        kind: 'from-btc-swap',
        transactionType: 'btc',
        transactionRequest: {
            depositAddress: revealAddress,
            validUntil,
            tokenAmountOut: amountOut,
        },
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOutMin,
        priceImpact,
        approveTo: AddressZero,
        amountInUsd: amountOut,
        routes: [
            {
                provider: 'symbiosis',
                tokens: [btc, syBtc],
            },
            ...routes,
        ],
        fees,
    }
}

async function buildTail(
    context: SwapExactInParams,
    btcConfig: BtcConfig,
    syBtcAmount: TokenAmount
): Promise<{
    tail: string
    fees: FeeItem[]
    routes: RouteItem[]
    priceImpact: Percent
    amountOut: TokenAmount
    amountOutMin: TokenAmount
}> {
    const { symbiosis, partnerAddress, to, tokenOut } = context

    const { symBtc } = btcConfig
    const chainId = syBtcAmount.token.chainId

    const calls: MultiCallItem[] = []
    const fees: FeeItem[] = []
    const routes: RouteItem[] = []

    const partnerFeeCall = await getPartnerFeeCall({
        symbiosis,
        amountIn: syBtcAmount,
        partnerAddress,
    })
    if (partnerFeeCall) {
        syBtcAmount = partnerFeeCall.amountOut // override
        calls.push(partnerFeeCall)
        fees.push(...partnerFeeCall.fees)
    }

    const feeCollector = symbiosis.getVolumeFeeCollector(syBtcAmount.token.chainId, [ChainId.BTC_MAINNET])
    if (feeCollector) {
        const volumeFeeCall = getVolumeFeeCall({
            feeCollector,
            amountIn: syBtcAmount,
        })
        syBtcAmount = volumeFeeCall.amountOut // override
        calls.push(volumeFeeCall)
        fees.push(...volumeFeeCall.fees)
    }

    const isOnChain = tokenOut.chainId === chainId
    const buildSwapFunc = isOnChain ? buildOnChainSwap : buildCrossChainSwap

    const swapCalls = await buildSwapFunc(context, syBtcAmount, btcConfig)
    let amountOut = syBtcAmount
    let amountOutMin = syBtcAmount
    let priceImpact = new Percent('0', BIPS_BASE)

    if (swapCalls.length > 0) {
        calls.push(...swapCalls)
        fees.push(...swapCalls.map((i) => i.fees).flat())
        routes.push(...swapCalls.map((i) => i.routes).flat())
        amountOut = swapCalls[swapCalls.length - 1].amountOut
        amountOutMin = swapCalls[swapCalls.length - 1].amountOutMin
        priceImpact = swapCalls[swapCalls.length - 1].priceImpact
    }

    const multicallRouter = symbiosis.multicallRouter(chainId)
    const multicallCalldata = multicallRouter.interface.encodeFunctionData('multicall', [
        '0', // will be patched
        [...calls.map((i) => i.data)],
        [...calls.map((i) => i.to)],
        [...calls.map((i) => (i.amountIn.token.isNative ? AddressZero : i.amountIn.token.address))],
        [...calls.map((i) => i.offset)],
        to,
    ])
    const symBtcContract = SymBtc__factory.connect(symBtc.address, symbiosis.getProvider(chainId))
    const tail = await symBtcContract.callStatic.packBTCTransactionTail({
        receiveSide: multicallRouter.address,
        receiveSideCalldata: multicallCalldata,
        receiveSideOffset: 36,
    })

    return { tail, fees, routes, priceImpact, amountOut, amountOutMin }
}

async function buildOnChainSwap(
    context: SwapExactInParams,
    syBtcAmount: TokenAmount,
    btcConfig: BtcConfig
): Promise<MultiCallItem[]> {
    const { to, tokenAmountIn, tokenOut, symbiosis } = context

    if (syBtcAmount.token.equals(tokenOut)) {
        return []
    }
    const aggregatorTrade = new AggregatorTrade({
        ...context,
        tokenAmountIn: syBtcAmount,
        tokenAmountInMin: syBtcAmount,
        from: to, // there is not from address, set user's address
        clientId: symbiosis.clientId,
        preferOneInchUsage: isUseOneInchOnly(tokenAmountIn.token, tokenOut),
    })
    await aggregatorTrade.init()

    const dep = context.symbiosis.depository(syBtcAmount.token.chainId)
    if (dep) {
        const transferCall = ERC20__factory.createInterface().encodeFunctionData('transfer', [
            to,
            aggregatorTrade.amountOutMin.toBigInt(),
        ])
        const call = await buildDepositCall({
            context,
            dep,
            syBtcAmount,
            tokenAmountOutMin: aggregatorTrade.amountOutMin,
            btcConfig,
            target: aggregatorTrade.amountOutMin.token.address,
            targetCalldata: transferCall,
            targetOffset: 68n,
        })
        call.fees = aggregatorTrade.fees || []
        call.priceImpact = aggregatorTrade.priceImpact

        return [call]
    } else {
        return [
            {
                to: aggregatorTrade.routerAddress,
                data: aggregatorTrade.callData,
                offset: aggregatorTrade.callDataOffset,
                fees: aggregatorTrade.fees || [],
                amountOut: aggregatorTrade.amountOut,
                amountOutMin: aggregatorTrade.amountOutMin,
                amountIn: syBtcAmount,
                routes: [
                    {
                        provider: aggregatorTrade.tradeType,
                        tokens: [syBtcAmount.token, aggregatorTrade.tokenOut],
                    },
                ],
                value: '0',
                priceImpact: aggregatorTrade.priceImpact,
            },
        ]
    }
}

async function buildCrossChainSwap(
    context: SwapExactInParams,
    syBtcAmount: TokenAmount,
    btcConfig: BtcConfig
): Promise<MultiCallItem[]> {
    const { to } = context

    const swapExactInResult = await bestPoolSwapping({
        ...context,
        tokenAmountIn: syBtcAmount,
        from: to, // to be able to revert a tx
        tradeAContext: 'multicallRouter',
        partnerAddress: undefined, // don't need to call partner fee twice
    })
    const data = (swapExactInResult.transactionRequest as TransactionRequest).data!
    const result = MetaRouter__factory.createInterface().decodeFunctionData('metaRoute', data)
    const tx = result._metarouteTransaction as MetaRouteStructs.MetaRouteTransactionStruct

    const dep = context.symbiosis.depository(syBtcAmount.token.chainId)
    if (dep) {
        if (swapExactInResult.tradeA) {
            // There is DEX-swap on BSC, lock to Depository instead.
            const call = await buildDepositCall({
                context,
                dep,
                syBtcAmount,
                tokenAmountOutMin: swapExactInResult.tradeA.amountOutMin,
                btcConfig,
                target: tx.relayRecipient,
                targetCalldata: tx.otherSideCalldata,
                targetOffset: 100n, // metaSynthesize struct size
            })
            call.fees = swapExactInResult.fees || []
            call.priceImpact = swapExactInResult.priceImpact
            return [call]
        } else {
            // There is no on-chain swap, Depository is not needed.
            return [
                {
                    to: tx.relayRecipient,
                    data: tx.otherSideCalldata,
                    offset: 100, // metaSynthesize struct
                    fees: swapExactInResult.fees,
                    routes: swapExactInResult.routes,
                    value: '0',
                    amountIn: syBtcAmount,
                    amountOut: swapExactInResult.tokenAmountOut,
                    amountOutMin: swapExactInResult.tokenAmountOutMin,
                    priceImpact: swapExactInResult.priceImpact,
                },
            ]
        }
    } else {
        const calls: MultiCallItem[] = []
        let amountIn = syBtcAmount
        if (swapExactInResult.tradeA) {
            // There is DEX-swap on BSC
            calls.push({
                to: tx.firstDexRouter,
                data: tx.firstSwapCalldata,
                offset: swapExactInResult.tradeA.callDataOffset,
                fees: [],
                routes: [],
                value: '0',
                amountIn,
                amountOut: swapExactInResult.tradeA.amountOut,
                amountOutMin: swapExactInResult.tradeA.amountOutMin,
                priceImpact: new Percent('0', BIPS_BASE),
            })
            amountIn = swapExactInResult.tradeA.amountOut
        }

        calls.push({
            to: tx.relayRecipient,
            data: tx.otherSideCalldata,
            offset: 100, // metaSynthesize struct
            fees: swapExactInResult.fees,
            routes: swapExactInResult.routes,
            value: '0',
            amountIn,
            amountOut: swapExactInResult.tokenAmountOut,
            amountOutMin: swapExactInResult.tokenAmountOutMin,
            priceImpact: swapExactInResult.priceImpact,
        })
        return calls
    }
}

type BuildDepositCallParameters = {
    context: SwapExactInParams
    dep: DepositoryContracts
    syBtcAmount: TokenAmount
    tokenAmountOutMin: TokenAmount
    btcConfig: BtcConfig
    target: string
    targetCalldata: BytesLike
    targetOffset: BigNumberish
}

async function buildDepositCall({
    context,
    dep,
    syBtcAmount,
    tokenAmountOutMin,
    btcConfig,
    target,
    targetCalldata,
    targetOffset,
}: BuildDepositCallParameters): Promise<MultiCallItem> {
    const { to, refundAddress } = context
    const fromToken = syBtcAmount.token
    const toToken = tokenAmountOutMin.token

    const swapCondition = await dep.swapUnlocker.encodeCondition({
        outToken: toToken.address, // destination token
        outMinAmount: tokenAmountOutMin.toBigInt(),
        target, // target to send destination token after validation
        targetCalldata, // calldata to call on target. If it's empty then tokens are simply transferred
        targetOffset, // offset to patch-in amountTo in targetCalldata
    })
    const withdrawCondition = await dep.withdrawUnlocker.encodeCondition({
        recipient: to, // owner can withdraw fromToken directly
    })
    const unlockers = [
        {
            unlocker: dep.swapUnlocker.address,
            condition: swapCondition,
        },
        {
            unlocker: dep.withdrawUnlocker.address,
            condition: withdrawCondition,
        },
    ]
    if (refundAddress !== undefined && refundAddress !== '' && dep.btcRefundUnlocker !== undefined) {
        const refundScript = getPkScript(refundAddress, btcConfig.btc.chainId)
        const btcRefundCondition = await dep.btcRefundUnlocker.encodeCondition({
            refundAddress: refundScript,
        })
        unlockers.push({
            unlocker: dep.btcRefundUnlocker.address,
            condition: btcRefundCondition,
        })
    }
    const condition = await dep.branchedUnlocker.encodeCondition({
        unlockers: unlockers,
    })
    const nonce = BigInt(`0x${randomBytes(32).toString('hex')}`)
    const deposit = {
        token: fromToken.address, // source token
        amount: syBtcAmount.toBigInt(), // amount of fromToken
        nonce: nonce, // To be able to create identical deposits
    }
    const unlocker = {
        unlocker: dep.branchedUnlocker.address,
        condition: condition,
    }
    const lockTx = await dep.depository.populateTransaction.lock(deposit, unlocker)

    return {
        to: dep.depository.address,
        data: lockTx.data!,
        offset: 4 + 32 + 32, // Offset to `amount` field in DepositoryTypes.Deposit
        routes: [
            {
                provider: 'depository',
                tokens: [syBtcAmount.token, tokenAmountOutMin.token],
            },
        ],
        value: '0',
        amountIn: syBtcAmount,
        amountOut: tokenAmountOutMin,
        amountOutMin: tokenAmountOutMin,
        fees: [],
        priceImpact: new Fraction(0n),
    }
}

interface DepositAddressResult {
    revealAddress: string
    validUntil: string
    legacyAddress: string
}

type EstimateWrapParams = {
    forwarderUrl: string
    portalFee: string
    stableBridgingFee: string
    tail: string
    to: string
    amount: string
    refundAddress?: string
    clientId?: string
}
export type EstimateWrapBodyParams = {
    amount: number
    info: {
        portalFee: number
        op: number
        stableBridgingFee: number
        tail: string
        to: string
    }
    refundAddress?: string
    clientId?: string
}

async function estimateWrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    amount,
    refundAddress,
    clientId,
}: EstimateWrapParams): Promise<BigNumber> {
    const estimateWrapApiUrl = new URL(`${forwarderUrl}/estimate-wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })

    const body: EstimateWrapBodyParams = {
        amount: Number(amount),
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - wrap operation
            stableBridgingFee: Number(stableBridgingFee),
            tail: encodeTail(tail),
            to,
        },
        clientId,
    }
    if (refundAddress) {
        body.refundAddress = refundAddress
    }

    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(body),
    }

    const response = await fetch(`${estimateWrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const { revealTxFee } = await response.json()

    return BigNumber.from(revealTxFee)
}

type WrapParams = EstimateWrapParams & {
    feeLimit: string
}
export type WrapBodyParams = EstimateWrapBodyParams & {
    feeLimit: number
}

async function wrap({
    forwarderUrl,
    portalFee,
    stableBridgingFee,
    tail,
    to,
    feeLimit,
    amount,
    refundAddress,
    clientId,
}: WrapParams): Promise<DepositAddressResult> {
    const body: WrapBodyParams = {
        info: {
            portalFee: Number(portalFee),
            op: 0, // 0 - is wrap operation
            stableBridgingFee: Number(stableBridgingFee),
            tail: encodeTail(tail),
            to,
        },
        clientId,
        feeLimit: Number(feeLimit),
        amount: Number(amount),
    }
    if (refundAddress) {
        body.refundAddress = refundAddress
    }

    const wrapApiUrl = new URL(`${forwarderUrl}/wrap`)
    const myHeaders = new Headers({
        accept: 'application/json',
        'Content-Type': 'application/json',
    })
    const requestOptions = {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify(body),
    }

    const response = await fetch(`${wrapApiUrl}`, requestOptions)
    if (!response.ok) {
        const text = await response.text()
        const json = JSON.parse(text)
        throw new Error(json.message ?? text)
    }

    const data = await response.json()

    const { revealAddress, validUntil, legacyAddress } = data

    return {
        revealAddress,
        validUntil,
        legacyAddress,
    }
}

function encodeTail(tail: string): string {
    return Buffer.from(tail.slice(2), 'hex').toString('base64')
}

async function getBtcPortalFee(forwarderUrl: string, cache: Cache): Promise<string> {
    let fee = await cache.get(
        ['getMinBtcFee'],
        async () => {
            // kind of the state: 0=finalized 1=pending 2=best
            const portalApiUrl = new URL(`${forwarderUrl}/portal?kind=2`)

            const response = await fetch(portalApiUrl)
            if (!response.ok) {
                const text = await response.text()
                const json = JSON.parse(text)
                throw new Error(json.message ?? text)
            }

            const {
                state: { minBtcFee },
            } = await response.json()

            return Number(minBtcFee)
        },
        600 // 10 minutes
    )

    try {
        const fastestFee = await cache.get(['getFastestFee'], getFastestFee, 60) // 1 minute
        const recommendedFee = fastestFee * 200 // 200 vByte
        if (recommendedFee > fee) {
            fee = recommendedFee
        }
    } catch {
        /* nothing */
    }
    return fee.toString()
}

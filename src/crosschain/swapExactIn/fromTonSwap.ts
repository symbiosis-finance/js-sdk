import { OmniPoolConfig, SwapExactInParams, SwapExactInResult, TonTransactionData } from '../types'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { isAddress } from 'ethers/lib/utils'
import { Address, beginCell, toNano } from '@ton/core'
import { ChainId } from '../../constants'
import { isTonChainId, splitSlippage } from '../chainUtils'
import { Bridge } from '../chainUtils/ton'
import { Percent, TokenAmount } from '../../entities'
import { CROSS_CHAIN_ID } from '../constants'
import { Transit } from '../transit'
import { theBestOutput } from './utils'
import { Symbiosis } from '../symbiosis'

export const MIN_META_SYNTH_TONS = toNano('0.02')
export const MIN_META_SYNTH_JETTONS = toNano('0.1')

const EVM_TO_TON = {
    '0x7ea393298d1077e19ec59f8e3fe8fe642738c08c': 'EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4', // TON
    '0x46deec715e419a1f0f5959b5c8450894959d2dbf': 'EQD73uqQJHKAg140YSlG3uxxXkGaHw9ZWbXIRQiUlZ0tv79a', // USDT
}

export function isFromTonSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, symbiosis } = context

    if (!isTonChainId(tokenAmountIn.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(tokenAmountIn)

    return true
}

export async function fromTonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut } = context

    const promises: Promise<SwapExactInResult>[] = []

    symbiosis.config.omniPools.forEach((poolConfig) => {
        const transitTokenCombinations = symbiosis.getTransitCombinations(
            tokenAmountIn.token.chainId,
            tokenOut.chainId,
            poolConfig
        )

        transitTokenCombinations.forEach(({ transitTokenIn, transitTokenOut }) => {
            const newContext = { ...context, transitTokenIn, transitTokenOut }

            const promise = doExactIn({ context: newContext, poolConfig })
            promises.push(promise)
        })
    })

    const bestOutput = await theBestOutput(promises)

    return {
        ...bestOutput,
        kind: 'crosschain-swap',
        approveTo: AddressZero,
        fees: [
            {
                provider: 'ton-call',
                description: 'TON method call',
                value: new TokenAmount(tokenAmountIn.token, MIN_META_SYNTH_TONS),
            },
            ...bestOutput.fees,
        ],
    }
}

interface ExactInParams {
    context: SwapExactInParams
    poolConfig: OmniPoolConfig
}

async function doExactIn(params: ExactInParams): Promise<SwapExactInResult> {
    const bridgeResult = tryToBuildBridgeCall(params)
    if (bridgeResult) {
        return bridgeResult
    }

    const { context, poolConfig } = params
    const { symbiosis, tokenAmountIn, to, deadline, from } = context

    if (!isAddress(to)) {
        throw new Error(`Receiver address is incorrect`)
    }
    // TODO calculate fee from source chain to host chain with advisor
    // call metaMintSyntheticToken
    // const fee1 = undefined // in sToken (amount in sTon)

    // (portal) metaSynthesize ->
    // (synthesis) metaMintSyntheticToken + swap on octopool + metaBurnSyntheticToken () ->
    // (portal) metaUnsynthesize (finalCalldata2).
    const {
        to: secondDexRouter,
        data: secondSwapCallData,
        amount: amountToBurn,
        swapTokens,
    } = await buildSecondCall(params)

    // TODO calculate fee from host chain to dest chain with advisor
    const fee2 = undefined

    const {
        to: finalReceiveSide,
        data: finalCallData,
        offset: finalOffset,
        amount: amountOut,
    } = buildFinalCall(params, amountToBurn, fee2)

    if (!swapTokens) {
        throw new Error('! swap tokens')
    }

    const transactionData = buildTonTransactionRequest({
        symbiosis,
        from,
        amountIn: tokenAmountIn,
        amountOut,
        secondDexRouter,
        secondSwapCallData,
        swapTokens,
        finalReceiveSide,
        finalCallData,
        finalOffset,
        evmAddress: to,
        poolChainId: poolConfig.chainId,
        validUntil: deadline,
    })

    return {
        kind: 'crosschain-swap',
        transactionType: 'ton',
        transactionRequest: transactionData,
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        approveTo: '',
        routes: [],
        fees: [],
        priceImpact: new Percent('0', '0'),
    }
}

function tryToBuildBridgeCall(params: ExactInParams): SwapExactInResult | undefined {
    const { context, poolConfig } = params
    const { symbiosis, tokenAmountIn, tokenOut, to, deadline } = context

    const sToken = symbiosis.getRepresentation(tokenAmountIn.token, poolConfig.chainId)
    if (!sToken) {
        return
    }
    if (!tokenOut.equals(sToken)) {
        return
    }

    const tonPortal = symbiosis.config.chains.find((chain) => chain.id === tokenAmountIn.token.chainId)?.tonPortal
    if (!tonPortal) {
        throw new Error('Ton portal not found in symbiosis config')
    }

    const tonTokenAddressInEvm = tokenAmountIn.token.address.toLowerCase() as keyof typeof EVM_TO_TON
    const tonTokenAddress = EVM_TO_TON[tonTokenAddressInEvm]
    if (!tonTokenAddress) {
        throw new Error('EVM address not found in EVM_TO_TON')
    }

    const cell = Bridge.synthesizeMessage({
        stableBridgingFee: BigInt('0'),
        token: Address.parse(tonTokenAddress),
        amount: BigInt(tokenAmountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'),
        receiveSide: Buffer.from(symbiosis.synthesis(poolConfig.chainId).address.slice(2), 'hex'),
        oppositeBridge: Buffer.from(symbiosis.bridge(poolConfig.chainId).address.slice(2), 'hex'),
        revertableAddress: Buffer.from(to.slice(2), 'hex'),
        chainId: BigInt(poolConfig.chainId),
    })

    return {
        kind: 'bridge',
        transactionType: 'ton',
        transactionRequest: {
            validUntil: deadline,
            messages: [
                {
                    address: tonPortal,
                    amount: tokenAmountIn.add(new TokenAmount(tokenAmountIn.token, MIN_META_SYNTH_TONS)).raw.toString(),
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        },
        tokenAmountOut: new TokenAmount(tokenOut, tokenAmountIn.raw),
        tokenAmountOutMin: new TokenAmount(tokenOut, tokenAmountIn.raw),
        approveTo: '',
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [
            {
                provider: 'symbiosis',
                value: new TokenAmount(tokenOut, '0'),
                description: 'Bridge fee',
            },
        ],
        priceImpact: new Percent('0', '0'),
    }
}

interface Call {
    to: string
    data: string
    offset: number
    amount: TokenAmount
    swapTokens?: string[]
}

async function buildSecondCall(params: ExactInParams): Promise<Call> {
    const { context, poolConfig } = params
    const { tokenAmountIn, tokenOut, symbiosis, transitTokenIn, transitTokenOut, slippage, deadline } = context

    if (!transitTokenIn || !transitTokenOut) {
        throw new Error('Transit tokens not found')
    }

    const syntheticFrom = symbiosis.getRepresentation(transitTokenIn, poolConfig.chainId)
    const syntheticTo = symbiosis.getRepresentation(transitTokenOut, poolConfig.chainId)
    if (!syntheticFrom || !syntheticTo) {
        throw new Error('Synthetic tokens not found')
    }

    // assume no tradeA and tradeC
    const splittedSlippage = splitSlippage(slippage, false, false)

    symbiosis.validateLimits(tokenAmountIn)

    // add fee from advisor, last param for transit
    const transit = new Transit(
        symbiosis,
        tokenAmountIn,
        tokenAmountIn,
        tokenOut,
        transitTokenIn,
        transitTokenOut,
        splittedSlippage['B'],
        deadline,
        poolConfig
    )

    await transit.init()

    // calldata for pool swap + fee (skipped)
    const transitCalls = transit.calls()
    if (!transitCalls) {
        throw new Error('Transit calls not found')
    }

    const { calldatas, receiveSides, paths, offsets } = transitCalls

    const multicallRouter = symbiosis.multicallRouter(poolConfig.chainId)

    const data = multicallRouter.interface.encodeFunctionData('multicall', [
        transit.amountIn.raw.toString(),
        calldatas, // calldata
        receiveSides, // receiveSides
        paths, // path
        offsets, // offset
        symbiosis.metaRouter(poolConfig.chainId).address,
    ])

    const synthesis = symbiosis.synthesis(poolConfig.chainId)

    return {
        to: synthesis.address,
        data,
        offset: 0,
        amount: transit.amountOut,
        swapTokens: [syntheticFrom.address, syntheticTo.address],
    }
}

function buildFinalCall(params: ExactInParams, amountToBurn: TokenAmount, feeV2?: TokenAmount | undefined): Call {
    const { context, poolConfig } = params
    const { symbiosis, tokenOut, to } = context

    const synthesis = symbiosis.synthesis(poolConfig.chainId)

    const data = synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
        {
            stableBridgingFee: feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            amount: amountToBurn.raw.toString(), // uint256 amount;
            syntCaller: symbiosis.metaRouter(poolConfig.chainId).address, // address syntCaller;
            crossChainID: CROSS_CHAIN_ID,
            finalReceiveSide: AddressZero, // address finalReceiveSide;
            sToken: amountToBurn.token.address, // address sToken;
            finalCallData: [], // bytes finalCallData;
            finalOffset: 0, // uint256 finalOffset;
            chain2address: to, // address chain2address;
            receiveSide: symbiosis.portal(tokenOut.chainId).address,
            oppositeBridge: symbiosis.bridge(tokenOut.chainId).address,
            revertableAddress: to,
            chainID: tokenOut.chainId,
            clientID: symbiosis.clientId,
        },
    ])

    return {
        to: synthesis.address,
        data,
        amount: new TokenAmount(tokenOut, amountToBurn.raw), // TODO subtract feeV2
        offset: 100,
    }
}

interface MetaSynthesizeParams {
    symbiosis: Symbiosis
    from: string
    amountIn: TokenAmount
    poolChainId: ChainId
    evmAddress: string
    swapTokens: string[]
    secondSwapCallData: string
    secondDexRouter: string
    finalCallData: string
    finalReceiveSide: string
    finalOffset: number
    amountOut: TokenAmount
    validUntil: number
}

function buildTonTransactionRequest(params: MetaSynthesizeParams): TonTransactionData {
    const {
        symbiosis,
        from,
        amountIn,
        evmAddress,
        poolChainId,
        swapTokens,
        secondDexRouter,
        secondSwapCallData,
        finalReceiveSide,
        finalCallData,
        finalOffset,
        validUntil,
    } = params
    const tonPortal = symbiosis.config.chains.find((chain) => chain.id === amountIn.token.chainId)?.tonPortal
    if (!tonPortal) {
        throw new Error(`No TON portal for chain ${amountIn.token.chainId}`)
    }

    const synthesisAddress = symbiosis.synthesis(poolChainId).address
    const bridgeAddress = symbiosis.bridge(poolChainId).address

    const WTON_EVM_ADDRESS = symbiosis
        .tokens()
        .find((token) => token.chainId === ChainId.TON_TESTNET && token.isNative)?.address

    const USDT_EVM_ADDRESS = symbiosis
        .tokens()
        .find((token) => token.chainId === ChainId.TON_TESTNET && token.symbol?.toLowerCase() === 'usdt')?.address

    if (amountIn.token.address === WTON_EVM_ADDRESS) {
        const cell = Bridge.metaSynthesizeMessage({
            stableBridgingFee: BigInt('0'), // fee taken on host chain
            token: Address.parse(WTON_EVM_ADDRESS), // simulate jetton for gas token TEP-161
            amount: BigInt(amountIn.raw.toString()),
            chain2Address: Buffer.from(evmAddress.slice(2), 'hex'),
            receiveSide: Buffer.from(synthesisAddress.slice(2), 'hex'),
            oppositeBridge: Buffer.from(bridgeAddress.slice(2), 'hex'),
            chainId: BigInt(poolChainId),
            revertableAddress: Buffer.from(evmAddress.slice(2), 'hex'), // evm this.to
            swapTokens: swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
            secondDexRouter: Buffer.from(secondDexRouter.slice(2), 'hex'),
            secondSwapCallData: Buffer.from(secondSwapCallData.slice(2), 'hex'),
            finalCallData: Buffer.from(finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
            finalReceiveSide: Buffer.from(finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
            finalOffset: BigInt(finalOffset),
        })

        return {
            validUntil,
            messages: [
                {
                    address: tonPortal,
                    amount: amountIn.add(new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)).raw.toString(), // FIXME not possible to sum USDT and TON
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        }
    } else if (amountIn.token.address === USDT_EVM_ADDRESS) {
        const metaSynthesizeBody = Bridge.metaSynthesizeMessage({
            stableBridgingFee: BigInt('0'), // fee taken on host chain
            token: Address.parse(USDT_EVM_ADDRESS),
            amount: BigInt(amountIn.raw.toString()),
            chain2Address: Buffer.from(evmAddress.slice(2), 'hex'),
            receiveSide: Buffer.from(synthesisAddress.slice(2), 'hex'),
            oppositeBridge: Buffer.from(bridgeAddress.slice(2), 'hex'),
            chainId: BigInt(poolChainId),
            revertableAddress: Buffer.from(evmAddress.slice(2), 'hex'), // evm this.to
            swapTokens: swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
            secondDexRouter: Buffer.from(secondDexRouter.slice(2), 'hex'),
            secondSwapCallData: Buffer.from(secondSwapCallData.slice(2), 'hex'),
            finalCallData: Buffer.from(finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
            finalReceiveSide: Buffer.from(finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
            finalOffset: BigInt(finalOffset),
        })

        const cell = beginCell()
            .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
            .storeUint(0, 64) // query id
            .storeCoins(BigInt(amountIn.raw.toString())) // jetton amount
            .storeAddress(Address.parse(tonPortal)) // destination
            .storeAddress(Address.parse(from)) // response_destination for excesses of ton
            .storeBit(0) // null custom payload
            .storeCoins(toNano('0.05')) // forward amount - if >0, will send notification message
            .storeMaybeRef(metaSynthesizeBody)
            .endCell()

        return {
            validUntil,
            messages: [
                {
                    address: '', // [TODO]: Calc your own jetton wallet address to send jettons
                    amount: amountIn.add(new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)).raw.toString(), // FIXME not possible to sum USDT and TON
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        }
    }

    throw new Error('No TON transaction request. Unsupported token')
}

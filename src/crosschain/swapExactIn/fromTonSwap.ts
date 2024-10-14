import { OmniPoolConfig, SwapExactInParams, SwapExactInResult, TonTransactionData } from '../types'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { isAddress } from 'ethers/lib/utils'
import { Address, toNano } from '@ton/core'
import { ChainId } from '../../constants'
import { isTonChainId, splitSlippage } from '../chainUtils'
import { Bridge } from '../chainUtils/ton'
import { Percent, TokenAmount } from '../../entities'
import { CROSS_CHAIN_ID } from '../constants'
import { Transit } from '../transit'
import { theBestOutput } from './utils'
import { Symbiosis } from '../symbiosis'

export const MIN_META_SYNTH_TONS = toNano('0.02')

export function isFromTonSwapSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, symbiosis } = context

    if (!isTonChainId(tokenAmountIn.token.chainId)) {
        return false
    }

    symbiosis.validateLimits(tokenAmountIn)

    return true
}

export async function fromTonSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, tokenAmountIn, tokenOut, to } = context

    const tonPortal = symbiosis.config.chains.find((i) => isTonChainId(i.id))?.tonPortal
    if (!tonPortal) {
        throw new Error('Ton portal not found in symbiosis config')
    }

    if (!isAddress(to)) {
        throw new Error(`Destination address wasn't provided`)
    }

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
    const { context, poolConfig } = params
    const { symbiosis, tokenAmountIn, to, deadline } = context

    const {
        to: secondDexRouter,
        data: secondSwapCallData,
        amount: amountToBurn,
        swapTokens,
    } = await buildSecondCall(params)

    const {
        to: finalReceiveSide,
        data: finalCallData,
        offset: finalOffset,
        amount: amountOut,
    } = buildFinalCall(params, amountToBurn)

    if (!swapTokens) {
        throw new Error('! swap tokens')
    }
    // best pool pass to create request
    const transactionData = buildTonTransactionRequest({
        symbiosis,
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
        transactionType: 'ton',
        transactionRequest: transactionData,
        kind: 'crosschain-swap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        approveTo: '',
        routes: [],
        fees: [],
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

    // calldata for octopul swap + fee (skipped)
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

// [TODO]: CASE for TON only, add case for jettons (USDT)
function buildTonTransactionRequest(params: MetaSynthesizeParams): TonTransactionData {
    const {
        symbiosis,
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

    const cell = Bridge.metaSynthesizeMessage({
        stableBridgingFee: BigInt('0'), // fee taken on host chain
        token: Address.parse(amountIn.token.address), // Address.parse('EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4'), // simulate jetton for gas token TEP-161
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
}

// function buildInternalId(bridgeAddr: Address, requestCount: bigint): string {
//     const bridgeAddressHex = '0x' + bridgeAddr.hash.toString('hex')
//
//     return solidityKeccak256(
//         ['int8', 'bytes32', 'uint256', 'uint256'],
//         [bridgeAddr.workChain, bridgeAddressHex, requestCount, ChainId.TON_TESTNET]
//     )
// }
//
// function buildExternalId({
//                                     internalId,
//                                     receiveSide,
//                                     revertableAddress,
//                                     chainId,
//                                 }: {
//     internalId: string
//     receiveSide: Buffer
//     revertableAddress: Buffer
//     chainId: bigint
// }): string {
//     return solidityKeccak256(
//         ['bytes32', 'address', 'address', 'uint256'],
//         [internalId, receiveSide, revertableAddress, chainId]
//     )
// }

// function buildMintSyntheticTokenCallData(
//     bridgeAddr: Address,
//     stableBridgingFee: bigint,
//     token: Address,
//     amount: bigint,
//     chain2Address: Buffer,
//     receiveSide: Buffer,
//     revertableAddress: Buffer,
//     chainId: bigint,
//     requestCount: bigint
// ): string {
//     const internalId = buildInternalId(bridgeAddr, requestCount)
//     const externalId = buildExternalId({
//         internalId,
//         receiveSide,
//         revertableAddress,
//         chainId,
//     })
//
//     const abiCoder = new AbiCoder()
//
//     const chain2AddrHex = '0x' + chain2Address.toString('hex')
//     // We convert token address to Ethereum-like address by taking last 20
//     // bytes of its hash
//     const tokenHashHex = '0x' + token.hash.subarray(12).toString('hex')
//
//     const signature = 'mintSyntheticToken(uint256,bytes32,bytes32,address,uint256,uint256,address)'
//     const selector = id(signature).substring(0, 10)
//
//     const paramTypes = ['uint256', 'bytes32', 'bytes32', 'address', 'uint256', 'uint256', 'address']
//
//     const paramValues = [stableBridgingFee, externalId, internalId, tokenHashHex, TON_CHAIN_ID, amount, chain2AddrHex]
//
//     const encodedParams = abiCoder.encode(paramTypes, paramValues)
//     const callData = selector.substring(2) + encodedParams.substring(2)
//
//     return callData
// }

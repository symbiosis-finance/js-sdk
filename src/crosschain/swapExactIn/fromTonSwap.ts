import { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../types'

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Error } from '../error'
import { AbiCoder, id, isAddress, solidityKeccak256 } from 'ethers/lib/utils'
import { Address, toNano } from '@ton/core'
import { ChainId } from '../../constants'
import { isTonChainId } from '../chainUtils/ton'
import { Bridge } from '../chainUtils/ton'
import { TON_CHAIN_ID } from '../chainUtils/ton'
import { Percent, TokenAmount } from '../../entities'
import { splitSlippage } from '../chainUtils/evm'
import { CROSS_CHAIN_ID } from '../constants'
import { Transit } from '../transit'

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
    const { symbiosis, tokenAmountIn, tokenOut, to, deadline } = context

    const tonPortal = symbiosis.config.chains.find((i) => isTonChainId(i.id))?.tonPortal

    if (!tonPortal) {
        throw new Error('Ton portal not found in symbiosis config')
    }

    if (!isAddress(to)) {
        throw new Error(`Destination address wasn't provided`)
    }

    const swapPromises: Promise<ToTonSwapExactIn>[] = []

    symbiosis.config.omniPools.forEach((poolConfig) => {
        const transitTokenCombinations = symbiosis.getTransitCombinations(
            tokenAmountIn.token.chainId,
            tokenOut.chainId,
            poolConfig
        )

        transitTokenCombinations.forEach(({ transitTokenIn, transitTokenOut }) => {
            const newContext = { ...context, transitTokenIn, transitTokenOut }

            const promise = doExactIn({ context: newContext, poolConfig })
            swapPromises.push(promise)
        })
    })

    const result = await Promise.all(swapPromises)

    // const bestOutput = await theBestOutput(promises)

    // best pool pass to create request
    const tonTransactionMessage = _getTonTransactionRequest(context, result[0])

    return {
        kind: 'crosschain-swap',
        transactionType: 'ton',
        transactionRequest: {
            validUntil: deadline.toString(),
            messages: [tonTransactionMessage],
        },
        tokenAmountOut: new TokenAmount(tokenOut, result[0].amountOut.raw.toString()),
        tokenAmountOutMin: new TokenAmount(tokenOut, result[0].amountOut.raw.toString()),
        priceImpact: new Percent(BigInt(10), BigInt(10000)),
        approveTo: AddressZero,
        // amountInUsd: '',
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [
            {
                provider: 'symbiosis',
                description: 'Mint fee',
                value: new TokenAmount(tokenAmountIn.token, MIN_META_SYNTH_TONS),
            },
        ],
    }
}

interface TonTransactionMessage {
    address: string
    amount: string
    payload: string
}

// [TODO]: CASE for TON only, add case for jettons (USDT)
function _getTonTransactionRequest(context: SwapExactInParams, params: ToTonSwapExactIn): TonTransactionMessage {
    const { symbiosis, tokenAmountIn, to } = context

    const tonPortal = symbiosis.config.chains.find((chain) => chain.id === tokenAmountIn.token.chainId)?.tonPortal

    if (!tonPortal) {
        throw new Error(`No TON portal for chain ${tokenAmountIn.token.chainId}`)
    }

    console.log('params TON transaction', {
        stableBridgingFee: BigInt('0'), // 1-st transfer ton --> hostchain
        token: Address.parse('EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4'), // simulate jetton for gas token TEP-161
        amount: BigInt(tokenAmountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'), // adress evm (my wallet)
        receiveSide: Buffer.from(symbiosis.synthesis(97).address.slice(2), 'hex'), // syntehsis host chain
        oppositeBridge: Buffer.from(symbiosis.bridge(97).address.slice(2), 'hex'), // bridge host chain
        chainId: BigInt(97), // host chain 97 (bsc testnet)
        revertableAddress: Buffer.from(to.slice(2), 'hex'), // evm this.to
        swapTokens: params.swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
        secondDexRouter: Buffer.from(params.secondDexRouter.slice(2), 'hex'), // octopul address hostchain
        secondSwapCallData: Buffer.from(params.secondSwapCallData.slice(2), 'hex'), // octopul calldata swap sTON --> sWTON hostchain
        finalCallData: Buffer.from(params.finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
        finalReceiveSide: Buffer.from(params.finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
        finalOffset: params.finalOffset, // finalOffset
    })

    const cell = Bridge.metaSynthesizeMessage({
        stableBridgingFee: BigInt('0'), // 1-st transfer ton --> hostchain
        token: Address.parse('EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4'), // simulate jetton for gas token TEP-161
        amount: BigInt(tokenAmountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'), // adress evm (my wallet)
        receiveSide: Buffer.from(symbiosis.synthesis(97).address.slice(2), 'hex'), // syntehsis host chain
        oppositeBridge: Buffer.from(symbiosis.bridge(97).address.slice(2), 'hex'), // bridge host chain
        chainId: BigInt(97), // host chain 97 (bsc testnet)
        revertableAddress: Buffer.from(to.slice(2), 'hex'), // evm this.to
        swapTokens: params.swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
        secondDexRouter: Buffer.from(params.secondDexRouter.slice(2), 'hex'), // octopul address hostchain
        secondSwapCallData: Buffer.from(params.secondSwapCallData.slice(2), 'hex'), // octopul calldata swap sTON --> sWTON hostchain
        finalCallData: Buffer.from(params.finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
        finalReceiveSide: Buffer.from(params.finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
        finalOffset: params.finalOffset, // finalOffset
    })

    return {
        address: tonPortal,
        amount: tokenAmountIn.add(new TokenAmount(tokenAmountIn.token, MIN_META_SYNTH_TONS)).raw.toString(),
        payload: cell.toBoc().toString('base64'),
    }
}

interface ToTonSwapExactIn {
    swapTokens: [string, string] // sTON, sWTON,
    secondSwapCallData: string
    secondDexRouter: string
    finalCallData: string
    finalReceiveSide: string
    finalOffset: bigint
    amountOut: TokenAmount
}

async function doExactIn({
    context,
    poolConfig,
}: {
    context: SwapExactInParams
    poolConfig: OmniPoolConfig
}): Promise<ToTonSwapExactIn> {
    const { symbiosis, tokenOut, tokenAmountIn, slippage, deadline, transitTokenIn, transitTokenOut } = context

    if (!transitTokenIn || !transitTokenOut) {
        throw new Error('Transit tokens not found')
    }

    const synthesis = symbiosis.synthesis(poolConfig.chainId)
    const synthteticFrom = symbiosis.getRepresentation(transitTokenIn, poolConfig.chainId)
    const synthteticTo = symbiosis.getRepresentation(transitTokenOut, poolConfig.chainId)

    if (!synthteticFrom || !synthteticTo) {
        throw new Error('Synthtetic tokens not found')
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

    const secondSwapCallData = multicallRouter.interface.encodeFunctionData('multicall', [
        transit.amountIn.raw.toString(),
        calldatas, // calldata
        receiveSides, // receiveSides
        paths, // path
        offsets, // offset
        symbiosis.metaRouter(poolConfig.chainId).address,
    ])

    const finalCallData = finalCalldataV2(context, transit, poolConfig)

    return {
        swapTokens: [synthteticFrom.address, synthteticTo.address], // sTON, sWTON,
        secondSwapCallData: secondSwapCallData,
        secondDexRouter: multicallRouter.address,
        finalCallData: finalCallData,
        finalReceiveSide: synthesis.address,
        finalOffset: BigInt(100),
        amountOut: transit.amountOut, // substract fee v2 from advisor
    }
}

export function finalCalldataV2(
    context: SwapExactInParams,
    transit: Transit,
    poolConfig: OmniPoolConfig,
    feeV2?: TokenAmount | undefined
): string {
    const { symbiosis, tokenOut, to } = context

    const synthesisV2 = symbiosis.synthesis(tokenOut.chainId)

    return synthesisV2.interface.encodeFunctionData('metaBurnSyntheticToken', [
        {
            stableBridgingFee: feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
            amount: transit.amountOut.raw.toString(), // uint256 amount;
            syntCaller: symbiosis.metaRouter(poolConfig.chainId).address, // address syntCaller;
            crossChainID: CROSS_CHAIN_ID,
            finalReceiveSide: AddressZero, // address finalReceiveSide;
            sToken: transit.amountOut.token.address, // address sToken;
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
}

export function buildInternalId(bridgeAddr: Address, requestCount: bigint): string {
    const bridgeAddressHex = '0x' + bridgeAddr.hash.toString('hex')

    const internalId = solidityKeccak256(
        ['int8', 'bytes32', 'uint256', 'uint256'],
        [bridgeAddr.workChain, bridgeAddressHex, requestCount, ChainId.TON_TESTNET]
    )

    return internalId
}

export function buildExternalId({
    internalId,
    receiveSide,
    revertableAddress,
    chainId,
}: {
    internalId: string
    receiveSide: Buffer
    revertableAddress: Buffer
    chainId: bigint
}): string {
    const externalId = solidityKeccak256(
        ['bytes32', 'address', 'address', 'uint256'],
        [internalId, receiveSide, revertableAddress, chainId]
    )

    return externalId
}

export function buildMintSyntheticTokenCallData(
    bridgeAddr: Address,
    stableBridgingFee: bigint,
    token: Address,
    amount: bigint,
    chain2Address: Buffer,
    receiveSide: Buffer,
    revertableAddress: Buffer,
    chainId: bigint,
    requestCount: bigint
): string {
    const internalId = buildInternalId(bridgeAddr, requestCount)
    const externalId = buildExternalId({
        internalId,
        receiveSide,
        revertableAddress,
        chainId,
    })

    const abiCoder = new AbiCoder()

    const chain2AddrHex = '0x' + chain2Address.toString('hex')
    // We convert token address to Ethereum-like address by taking last 20
    // bytes of its hash
    const tokenHashHex = '0x' + token.hash.subarray(12).toString('hex')

    const signature = 'mintSyntheticToken(uint256,bytes32,bytes32,address,uint256,uint256,address)'
    const selector = id(signature).substring(0, 10)

    const paramTypes = ['uint256', 'bytes32', 'bytes32', 'address', 'uint256', 'uint256', 'address']

    const paramValues = [stableBridgingFee, externalId, internalId, tokenHashHex, TON_CHAIN_ID, amount, chain2AddrHex]

    const encodedParams = abiCoder.encode(paramTypes, paramValues)
    const callData = selector.substring(2) + encodedParams.substring(2)

    return callData
}

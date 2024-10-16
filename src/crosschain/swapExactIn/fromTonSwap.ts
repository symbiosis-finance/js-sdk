import { OmniPoolConfig, SwapExactInParams, SwapExactInResult, TonTransactionData } from '../types'

import { Error } from '../error'
import { Address, beginCell, toNano } from '@ton/core'
import { ChainId } from '../../constants'
import { isTonChainId } from '../chainUtils'
import { Bridge, EVM_TO_TON } from '../chainUtils/ton'
import { TokenAmount } from '../../entities'
import { theBestOutput } from './utils'
import { Symbiosis } from '../symbiosis'
import { bridgeFromTon } from './fromTon/bridge'
import { SwappingFromTon } from '../swappingFromTon'

export const MIN_META_SYNTH_TONS = toNano('0.02')
export const MIN_META_SYNTH_JETTONS = toNano('0.1')

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

    return theBestOutput(promises)
}

export interface FromTonParams {
    context: SwapExactInParams
    poolConfig: OmniPoolConfig
}

async function doExactIn(params: FromTonParams): Promise<SwapExactInResult> {
    const bridgeResult = bridgeFromTon(params)
    if (bridgeResult) {
        return bridgeResult
    }

    const {
        context: { symbiosis },
        poolConfig,
    } = params
    const swapping = new SwappingFromTon(symbiosis, poolConfig)
    return swapping.doExactIn(params.context)
}

interface MetaSynthesizeParams {
    symbiosis: Symbiosis
    fee: TokenAmount
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
    validUntil: number
}

export function buildMetaSynthesize(params: MetaSynthesizeParams): TonTransactionData {
    const {
        symbiosis,
        fee,
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

    const WTON_EVM = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'ton')

    const USDT_EVM = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'usdt')

    const tonTokenAddress = EVM_TO_TON[amountIn.token.address.toLowerCase()]
    if (!tonTokenAddress) {
        throw new Error('EVM address not found in EVM_TO_TON')
    }

    const metaSynthesizeBody = Bridge.metaSynthesizeMessage({
        stableBridgingFee: BigInt(fee.raw.toString()),
        token: Address.parse(tonTokenAddress), // simulate jetton for gas token TEP-161
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

    if (WTON_EVM?.equals(amountIn.token)) {
        return {
            validUntil,
            messages: [
                {
                    address: tonPortal,
                    amount: amountIn.add(new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)).raw.toString(), // FIXME not possible to sum USDT and TON
                    payload: metaSynthesizeBody.toBoc().toString('base64'),
                },
            ],
        }
    } else if (USDT_EVM?.equals(amountIn.token)) {
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

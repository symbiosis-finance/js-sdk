import { Percent, TokenAmount, wrappedToken } from '../../entities'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload, TonTransactionData } from '../types'
import { AddressZero } from '@ethersproject/constants'
import { Error, ErrorCode } from '../error'
import {
    buildSynthesize,
    getExternalId,
    getInternalId,
    isEvmChainId,
    isTonChainId,
    isTronChainId,
    prepareTronTransaction,
    TronTransactionData,
} from '../chainUtils'
import { TRON_PORTAL_ABI } from '../tronAbis'
import { TransactionRequest } from '@ethersproject/providers'
import { Portal__factory, Synthesis__factory } from '../contracts'
import { MaxUint256 } from '@ethersproject/constants'
import { CROSS_CHAIN_ID } from '../constants'
import { Address } from '@ton/core'
import { parseUnits } from '@ethersproject/units'

export function isBridgeSupported(context: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, symbiosis } = context

    const wrappedInToken = wrappedToken(tokenAmountIn.token)
    const wrappedOutToken = wrappedToken(tokenOut)

    if (wrappedInToken.chainId === wrappedOutToken.chainId) {
        return false
    }

    try {
        const representation = symbiosis.getRepresentation(wrappedInToken, wrappedOutToken.chainId)
        return !!representation && representation.equals(wrappedOutToken)
    } catch {
        return false
    }
}

type Direction = 'mint' | 'burn'

export async function bridge(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut } = context

    const direction = getDirection(context)
    const revertableAddress = getRevertableAddress(context)
    const fee = await getFee(context, direction)
    const amountOut = getAmountOut(context, fee)
    const payload = await getTransactionPayload(context, fee, revertableAddress, direction)

    let approveTo = ''
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else if (payload.transactionType === 'evm') {
        approveTo = payload.transactionRequest.to as string
    }
    return {
        ...payload,
        kind: 'bridge',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        priceImpact: new Percent('0', '0'),
        approveTo,
        fees: [
            {
                provider: 'symbiosis',
                description: 'Bridge fee',
                value: fee,
            },
        ],
        routes: [
            {
                provider: 'symbiosis',
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
    }
}

function getDirection(context: SwapExactInParams): Direction {
    const { tokenAmountIn } = context
    if (tokenAmountIn.token.isSynthetic) {
        return 'burn'
    }
    return 'mint'
}

function getRevertableAddress(context: SwapExactInParams): string {
    const { from, tokenAmountIn, tokenOut, symbiosis } = context

    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    let address = from
    if (isTronChainId(chainIdIn) || isTronChainId(chainIdOut)) {
        address = symbiosis.getRevertableAddress(chainIdOut)
    } else if (isTonChainId(chainIdIn) || isTonChainId(chainIdOut)) {
        address = symbiosis.getRevertableAddress(chainIdOut)
    }

    return address
}

async function getFee(context: SwapExactInParams, direction: Direction): Promise<TokenAmount> {
    if (direction === 'burn') {
        return getBurnFee(context)
    }
    return getMintFee(context)
}

async function getMintFee(context: SwapExactInParams): Promise<TokenAmount> {
    const { symbiosis, tokenAmountIn, tokenOut, to } = context

    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    // TODO remove after advisor is implemented
    if (isTonChainId(chainIdIn)) {
        return new TokenAmount(tokenOut, parseUnits('0.1', tokenOut.decimals).toString())
    }

    const internalId = getInternalId({
        contractAddress: symbiosis.chainConfig(chainIdIn).portal,
        requestCount: MaxUint256, // we must use last possible request count because it is always free
        chainId: chainIdIn,
    })

    const synthesisAddress = symbiosis.chainConfig(chainIdOut).synthesis

    const externalId = getExternalId({
        internalId,
        contractAddress: synthesisAddress,
        revertableAddress: AddressZero, // doesn't matter which address is
        chainId: chainIdOut,
    })

    const token = wrappedToken(tokenAmountIn.token)

    const synthesisInterface = Synthesis__factory.createInterface()
    const calldata = synthesisInterface.encodeFunctionData('mintSyntheticToken', [
        '1', // stableBridgingFee,
        externalId, // externalID,
        CROSS_CHAIN_ID,
        token.address, // tokenReal,
        chainIdIn, // chainId
        tokenAmountIn.raw.toString(), // amount,
        to,
    ])

    const { price: fee } = await symbiosis.getBridgeFee({
        receiveSide: synthesisAddress,
        calldata,
        chainIdFrom: tokenAmountIn.token.chainId,
        chainIdTo: tokenOut.chainId,
    })

    return new TokenAmount(tokenOut, fee)
}

async function getBurnFee(context: SwapExactInParams): Promise<TokenAmount> {
    const { symbiosis, tokenAmountIn, tokenOut, to } = context
    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    // TODO remove after advisor is implemented
    if (isTonChainId(chainIdOut)) {
        return new TokenAmount(tokenOut, parseUnits('0.1', tokenOut.decimals).toString())
    }

    const internalId = getInternalId({
        contractAddress: symbiosis.chainConfig(chainIdIn).synthesis,
        requestCount: MaxUint256, // we must use last possible request count because it is always free
        chainId: chainIdIn,
    })

    const portalAddress = symbiosis.chainConfig(chainIdOut).portal

    const externalId = getExternalId({
        internalId,
        contractAddress: portalAddress,
        revertableAddress: AddressZero, // doesn't matter which address is
        chainId: chainIdOut,
    })

    const portalInterface = Portal__factory.createInterface()
    const calldata = portalInterface.encodeFunctionData('unsynthesize', [
        '1', // Bridging fee
        externalId,
        CROSS_CHAIN_ID,
        tokenOut.address, // The address of the token to unsynthesize
        tokenAmountIn.raw.toString(), // Number of tokens to unsynthesize
        to, // The address to receive tokens
    ])

    const { price: fee } = await symbiosis.getBridgeFee({
        receiveSide: portalAddress,
        calldata,
        chainIdFrom: chainIdIn,
        chainIdTo: chainIdOut,
    })

    return new TokenAmount(tokenOut, fee)
}

function getAmountOut(context: SwapExactInParams, fee: TokenAmount) {
    const { tokenAmountIn, tokenOut } = context
    const amountOut = new TokenAmount(tokenOut, tokenAmountIn.raw)
    if (amountOut.lessThan(fee)) {
        throw new Error(
            `Amount ${amountOut.toSignificant()} ${amountOut.token.symbol} less than fee ${fee.toSignificant()} ${
                fee.token.symbol
            }`,
            ErrorCode.AMOUNT_LESS_THAN_FEE
        )
    }
    return amountOut.subtract(fee)
}

async function getTransactionPayload(
    context: SwapExactInParams,
    fee: TokenAmount,
    revertableAddress: string,
    direction: Direction
): Promise<SwapExactInTransactionPayload> {
    const { tokenAmountIn } = context
    const chainIdIn = tokenAmountIn.token.chainId
    if (isTronChainId(chainIdIn)) {
        const transactionRequest = getTronTransactionRequest(context, fee, revertableAddress, direction)

        return {
            transactionType: 'tron',
            transactionRequest,
        }
    }

    if (isTonChainId(chainIdIn)) {
        const transactionRequest = await getTonTransactionRequest(context, fee, revertableAddress, direction)

        return {
            transactionType: 'ton',
            transactionRequest,
        }
    }

    if (isEvmChainId(chainIdIn)) {
        const transactionRequest = getEvmTransactionRequest(context, fee, revertableAddress, direction)

        return {
            transactionType: 'evm',
            transactionRequest,
        }
    }

    throw new Error(`Transaction payload can't be built. Unknown chainId type`)
}

function getTronTransactionRequest(
    context: SwapExactInParams,
    fee: TokenAmount,
    revertableAddress: string,
    direction: Direction
): TronTransactionData {
    const { symbiosis, tokenAmountIn, tokenOut, to, from } = context

    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    if (direction === 'burn') {
        throw new Error('Burn is not supported on Tron')
    }

    return prepareTronTransaction({
        chainId: chainIdIn,
        abi: TRON_PORTAL_ABI,
        ownerAddress: from,
        contractAddress: symbiosis.chainConfig(chainIdIn).portal,
        functionName: 'synthesize',
        params: [
            fee.raw.toString(),
            tokenAmountIn.token.address,
            tokenAmountIn.raw.toString(),
            to,
            symbiosis.chainConfig(chainIdOut).synthesis,
            symbiosis.chainConfig(chainIdOut).bridge,
            revertableAddress,
            chainIdOut.toString(),
            symbiosis.clientId,
        ],
        tronWeb: symbiosis.tronWeb(chainIdIn),
    })
}

async function getTonTransactionRequest(
    context: SwapExactInParams,
    fee: TokenAmount,
    revertableAddress: string,
    direction: Direction
): Promise<TonTransactionData> {
    if (direction === 'burn') {
        throw new Error('Burn is not supported on Tron')
    }

    const { symbiosis, tokenAmountIn, tokenOut, to, from, deadline } = context

    return buildSynthesize({
        symbiosis,
        fee,
        amountIn: tokenAmountIn,
        chainIdOut: tokenOut.chainId,
        from,
        to,
        revertableAddress,
        validUntil: deadline,
    })
}

function getEvmTransactionRequest(
    context: SwapExactInParams,
    fee: TokenAmount,
    revertableAddress: string,
    direction: Direction
): TransactionRequest {
    const { symbiosis, tokenAmountIn, tokenOut, to } = context
    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    if (direction === 'burn') {
        const synthesis = symbiosis.synthesis(chainIdIn)

        if (isTonChainId(chainIdOut)) {
            const { workChain, hash } = Address.parse(to)

            const tonAddress = {
                workchain: workChain,
                address_hash: `0x${hash.toString('hex')}`,
            }

            const data = synthesis.interface.encodeFunctionData('burnSyntheticTokenTON', [
                fee.raw.toString(),
                tokenAmountIn.token.address,
                tokenAmountIn.raw.toString(),
                CROSS_CHAIN_ID,
                tonAddress,
                AddressZero, // any arbitrary data, this addresses passed from relayer
                AddressZero, // any arbitrary data, this addresses passed from relayer
                revertableAddress,
                chainIdOut,
                symbiosis.clientId,
            ])
            return {
                chainId: chainIdIn,
                to: synthesis.address,
                data,
            }
        }

        const data = synthesis.interface.encodeFunctionData('burnSyntheticToken', [
            fee.raw.toString(),
            tokenAmountIn.token.address,
            tokenAmountIn.raw.toString(),
            to,
            symbiosis.chainConfig(chainIdOut).portal,
            symbiosis.chainConfig(chainIdOut).bridge,
            revertableAddress,
            chainIdOut,
            symbiosis.clientId,
        ])

        return {
            chainId: chainIdIn,
            to: synthesis.address,
            data,
        }
    }

    const portal = symbiosis.portal(chainIdIn)

    return {
        chainId: chainIdIn,
        to: portal.address,
        data: portal.interface.encodeFunctionData('synthesize', [
            fee.raw.toString(),
            tokenAmountIn.token.address,
            tokenAmountIn.raw.toString(),
            to,
            symbiosis.chainConfig(chainIdOut).synthesis,
            symbiosis.chainConfig(chainIdOut).bridge,
            revertableAddress,
            chainIdOut,
            symbiosis.clientId,
        ]),
    }
}

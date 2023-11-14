import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Token, TokenAmount } from '../../entities'
import { crosschainSwap } from './crosschainSwap'
import { getDecimals } from './getDecimals'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { onchainSwap } from './onchainSwap'
import { SwapExactInContex, SwapExactInParams, SwapExactInResult } from './types'
import { isTronChainId, tronAddressToEvm } from '../tron'
import { getAddress } from 'ethers/lib/utils'
import { isWrapSupported, wrap } from './wrap'
import { isUnwrapSupported, unwrap } from './unwrap'

function validateAddress(chainId: ChainId, address: string): void {
    if (isTronChainId(chainId)) {
        tronAddressToEvm(address)
    }

    getAddress(address)
}

// Universal stateless function that allows swap tokens on same chain or crosschain
export async function swapExactIn(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { symbiosis, inTokenAddress, inTokenChainId, outTokenAddress, outTokenChainId, amount } = params

    if (inTokenChainId === outTokenChainId && inTokenAddress === outTokenAddress) {
        throw new Error('Cannot swap same tokens')
    }

    try {
        validateAddress(inTokenChainId, inTokenAddress)
    } catch (error) {
        throw new Error(`Invalid address: ${inTokenChainId}/${inTokenAddress}`)
    }

    try {
        validateAddress(outTokenChainId, outTokenAddress)
    } catch (error) {
        throw new Error(`Invalid address: ${outTokenChainId}/${outTokenAddress}`)
    }

    const [decimalsIn, decimalsOut] = await getDecimals(
        symbiosis,
        { address: inTokenAddress, chainId: inTokenChainId },
        { address: outTokenAddress, chainId: outTokenChainId }
    )

    if (decimalsIn === undefined || decimalsOut === undefined) {
        throw new Error(
            `Cannot fetch decimals for ${inTokenChainId}/${inTokenAddress} and ${outTokenChainId}/${outTokenAddress}`
        )
    }

    const isInTokenNative = inTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
    const isOutTokenNative = outTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()

    const inToken = new Token({
        chainId: inTokenChainId,
        decimals: decimalsIn,
        address: isInTokenNative ? '' : inTokenAddress,
        isNative: isInTokenNative,
    })

    const outToken = new Token({
        chainId: outTokenChainId,
        decimals: decimalsOut,
        address: isOutTokenNative ? '' : outTokenAddress,
        isNative: isOutTokenNative,
    })

    const inAmount = new TokenAmount(inToken, amount)

    const swapContext: SwapExactInContex = {
        ...params,
        inAmount,
        outToken,
    }

    if (isWrapSupported(swapContext)) {
        return wrap(swapContext)
    }

    if (isUnwrapSupported(swapContext)) {
        return unwrap(swapContext)
    }

    if (isFeeCollectorSwapSupported(swapContext)) {
        return feeCollectorSwap(swapContext)
    }

    if (inToken.chainId === outToken.chainId) {
        return onchainSwap(swapContext)
    }

    return crosschainSwap(swapContext)
}

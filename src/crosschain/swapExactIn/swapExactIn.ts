import { tronAddressToEvm } from '../tron'
import { bridge, isBridgeSupported } from './bridge'
import { crosschainSwap } from './crosschainSwap'
import { feeCollectorSwap, isFeeCollectorSwapSupported } from './feeCollectorSwap'
import { onchainSwap } from './onchainSwap'
import { SwapExactInParams, SwapExactInResult } from './types'
import { isUnwrapSupported, unwrap } from './unwrap'
import { isWrapSupported, wrap } from './wrap'

// Universal stateless function that allows swap tokens on same chain or crosschain
export async function swapExactIn(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken } = params

    params.fromAddress = tronAddressToEvm(params.fromAddress)
    params.toAddress = tronAddressToEvm(params.toAddress)

    if (inTokenAmount.token.equals(outToken)) {
        throw new Error('Cannot swap same tokens')
    }

    if (isWrapSupported(params)) {
        return wrap(params)
    }

    if (isUnwrapSupported(params)) {
        return unwrap(params)
    }

    if (isFeeCollectorSwapSupported(params)) {
        return feeCollectorSwap(params)
    }

    if (inTokenAmount.token.chainId === outToken.chainId) {
        return onchainSwap(params)
    }

    if (isBridgeSupported(params)) {
        return bridge(params)
    }

    return crosschainSwap(params)
}

// Swap exact in unknown tokens
// function validateAddress(chainId: ChainId, address: string): void {
//     if (isTronChainId(chainId)) {
//         tronAddressToEvm(address)
//     }

//     getAddress(address)
// }

// try {
//     validateAddress(inTokenChainId, inTokenAddress)
// } catch (error) {
//     throw new Error(`Invalid address: ${inTokenChainId}/${inTokenAddress}`)
// }

// try {
//     validateAddress(outTokenChainId, outTokenAddress)
// } catch (error) {
//     throw new Error(`Invalid address: ${outTokenChainId}/${outTokenAddress}`)
// }

// const [decimalsIn, decimalsOut] = await getDecimals(
//     symbiosis,
//     { address: inTokenAddress, chainId: inTokenChainId },
//     { address: outTokenAddress, chainId: outTokenChainId }
// )

// if (decimalsIn === undefined || decimalsOut === undefined) {
//     throw new Error(
//         `Cannot fetch decimals for ${inTokenChainId}/${inTokenAddress} and ${outTokenChainId}/${outTokenAddress}`
//     )
// }

// const inToken = new Token({
//     chainId: inTokenChainId,
//     decimals: decimalsIn,
//     address: isInTokenNative ? '' : inTokenAddress,
//     isNative: isInTokenNative,
// })

// const outToken = new Token({
//     chainId: outTokenChainId,
//     decimals: decimalsOut,
//     address: isOutTokenNative ? '' : outTokenAddress,
//     isNative: isOutTokenNative,
// })

// const inAmount = new TokenAmount(inToken, amount)

// const isInTokenNative = inTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
// const isOutTokenNative = outTokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()

// const swapContext: SwapExactInContex = {
//     ...params,
//     inAmount,
//     outToken,
// }

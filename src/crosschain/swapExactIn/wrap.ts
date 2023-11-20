import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from './types'

export function isWrapSupported(params: SwapExactInParams): boolean {
    const { inTokenAmount, outToken, fromAddress, toAddress } = params

    if (fromAddress.toLowerCase() !== toAddress.toLowerCase()) {
        return false
    }

    const inChainId = inTokenAmount.token.chainId
    const outChainId = outToken.chainId

    const weth = WETH[inChainId]

    return inChainId === outChainId && inTokenAmount.token.isNative && weth && weth.equals(outToken)
}

export async function wrap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = params

    const { chainId } = inTokenAmount.token

    const weth = WETH[chainId]

    if (!weth) {
        throw new Error(`Wrap token not found for chain ${chainId}`)
    }

    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(weth, inTokenAmount.raw)

    const callData = wethInterface.encodeFunctionData('deposit')

    const payload = preparePayload({
        chainId,
        fromAddress: params.fromAddress,
        toAddress: weth.address,
        value: inTokenAmount.raw.toString(),
        callData,
    })

    return {
        kind: 'wrap',
        route: [inTokenAmount.token, weth],
        tokenAmountOut: amountOut,
        ...payload,
    }
}

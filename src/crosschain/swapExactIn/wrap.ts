import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInContex, SwapExactInTransactionPayload, SwapExactInWrap } from './types'

export function isWrapSupported(context: SwapExactInContex): boolean {
    const weth = WETH[context.inTokenChainId]

    return (
        context.inTokenChainId === context.outTokenChainId &&
        context.inAmount.token.isNative &&
        weth &&
        weth.address.toLowerCase() === context.outTokenAddress.toLowerCase()
    )
}

export async function wrap(context: SwapExactInContex): Promise<SwapExactInWrap & SwapExactInTransactionPayload> {
    const weth = WETH[context.inTokenChainId]

    if (!weth) {
        throw new Error(`Wrap token not found for chain ${context.inTokenChainId}`)
    }

    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(weth, context.inAmount.raw)

    const callData = wethInterface.encodeFunctionData('deposit')

    const payload = preparePayload({
        chainId: context.inTokenChainId,
        fromAddress: context.fromAddress,
        toAddress: weth.address,
        value: context.inAmount.raw.toString(),
        callData,
    })

    return {
        kind: 'wrap',
        route: [context.inAmount.token, weth],
        tokenAmountOut: amountOut,
        ...payload,
    }
}

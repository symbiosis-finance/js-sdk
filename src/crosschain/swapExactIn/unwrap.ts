import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInContex, SwapExactInTransactionPayload, SwapExactInUnwrap } from './types'

export function isUnwrapSupported(context: SwapExactInContex): boolean {
    const weth = WETH[context.inTokenChainId]

    return (
        context.inTokenChainId === context.outTokenChainId &&
        context.outToken.isNative &&
        weth &&
        weth.address.toLowerCase() === context.inTokenAddress.toLowerCase()
    )
}

export async function unwrap(context: SwapExactInContex): Promise<SwapExactInUnwrap & SwapExactInTransactionPayload> {
    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(context.outToken, context.inAmount.raw)

    const callData = wethInterface.encodeFunctionData('withdraw', [context.inAmount.raw.toString()])

    const payload = preparePayload({
        chainId: context.inTokenChainId,
        fromAddress: context.fromAddress,
        toAddress: context.inTokenAddress,
        callData,
    })

    return {
        kind: 'unwrap',
        route: [context.inAmount.token, context.outToken],
        tokenAmountOut: amountOut,
        ...payload,
    }
}

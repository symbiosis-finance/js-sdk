import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInTransactionPayload, SwapExactInUnwrap } from './types'

export function isUnwrapSupported(params: SwapExactInParams): boolean {
    const { inTokenAmount, outToken } = params

    const inChainId = inTokenAmount.token.chainId
    const outChainId = outToken.chainId

    const weth = WETH[inChainId]

    return inChainId === outChainId && outToken.isNative && weth && weth.equals(inTokenAmount.token)
}

export async function unwrap(params: SwapExactInParams): Promise<SwapExactInUnwrap & SwapExactInTransactionPayload> {
    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(params.outToken, params.inTokenAmount.raw)

    const callData = wethInterface.encodeFunctionData('withdraw', [params.inTokenAmount.raw.toString()])

    const payload = preparePayload({
        chainId: params.inTokenAmount.token.chainId,
        fromAddress: params.fromAddress,
        toAddress: params.inTokenAmount.token.address,
        callData,
    })

    return {
        kind: 'unwrap',
        route: [params.inTokenAmount.token, params.outToken],
        tokenAmountOut: amountOut,
        ...payload,
    }
}

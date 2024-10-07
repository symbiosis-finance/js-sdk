import { Percent, TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { getFunctionSelector } from '../tron'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

export function isUnwrapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, from, to } = params

    if (from.toLowerCase() !== to.toLowerCase()) {
        return false
    }

    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    const weth = WETH[chainIdIn]

    return chainIdIn === chainIdOut && tokenOut.isNative && weth && weth.equals(tokenAmountIn.token)
}

export async function unwrap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, from } = params
    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(tokenOut, tokenAmountIn.raw)

    const callData = wethInterface.encodeFunctionData('withdraw', [tokenAmountIn.raw.toString()])

    const functionSelector = getFunctionSelector(wethInterface.getFunction('withdraw'))

    const payload = preparePayload({
        functionSelector,
        chainId: tokenAmountIn.token.chainId,
        from,
        to: tokenAmountIn.token.address,
        callData,
    })

    let approveTo = AddressZero
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else if (payload.transactionType === 'evm') {
        approveTo = payload.transactionRequest.to as string
    }

    return {
        ...payload,
        kind: 'unwrap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        priceImpact: new Percent('0', '0'),
        approveTo,
        fees: [],
        routes: [
            {
                provider: 'wrap',
                tokens: [params.tokenAmountIn.token, params.tokenOut],
            },
        ],
    }
}

import { Percent, TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { getFunctionSelector } from '../chainUtils/tron'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from '../types'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { BIPS_BASE } from '../constants'

export function isWrapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, from, to } = params

    if (from.toLowerCase() !== to.toLowerCase()) {
        return false
    }

    const chainIdIn = tokenAmountIn.token.chainId
    const chainIdOut = tokenOut.chainId

    const weth = WETH[chainIdIn]

    return chainIdIn === chainIdOut && tokenAmountIn.token.isNative && weth && weth.equals(tokenOut)
}

export async function wrap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn } = params

    const { chainId } = tokenAmountIn.token

    const weth = WETH[chainId]

    if (!weth) {
        throw new Error(`Wrap token not found for chain ${chainId}`)
    }

    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(weth, tokenAmountIn.raw)

    const callData = wethInterface.encodeFunctionData('deposit')

    const functionSelector = getFunctionSelector(wethInterface.getFunction('deposit'))

    const payload = preparePayload({
        functionSelector,
        chainId,
        from: params.from,
        to: weth.address,
        value: tokenAmountIn.raw.toString(),
        callData,
    })

    let approveTo: string = AddressZero
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else if (payload.transactionType === 'evm') {
        approveTo = payload.transactionRequest.to as string
    }
    return {
        ...payload,
        kind: 'wrap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        priceImpact: new Percent('0', BIPS_BASE),
        approveTo,
        fees: [],
        routes: [
            {
                provider: 'wrap',
                tokens: [tokenAmountIn.token, weth],
            },
        ],
    }
}

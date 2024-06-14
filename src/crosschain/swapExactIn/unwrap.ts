import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { getFunctionSelector } from '../tron'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from './types'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

export function isUnwrapSupported(params: SwapExactInParams): boolean {
    const { inTokenAmount, outToken, fromAddress, toAddress } = params

    if (fromAddress.toLowerCase() !== toAddress.toLowerCase()) {
        return false
    }

    const inChainId = inTokenAmount.token.chainId
    const outChainId = outToken.chainId

    const weth = WETH[inChainId]

    return inChainId === outChainId && outToken.isNative && weth && weth.equals(inTokenAmount.token)
}

export async function unwrap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const wethInterface = Weth__factory.createInterface()

    const amountOut = new TokenAmount(params.outToken, params.inTokenAmount.raw)

    const callData = wethInterface.encodeFunctionData('withdraw', [params.inTokenAmount.raw.toString()])

    const functionSelector = getFunctionSelector(wethInterface.getFunction('withdraw'))

    const payload = preparePayload({
        functionSelector,
        chainId: params.inTokenAmount.token.chainId,
        fromAddress: params.fromAddress,
        toAddress: params.inTokenAmount.token.address,
        callData,
    })

    let approveTo: string
    if (payload.transactionType === 'tron') {
        approveTo = payload.transactionRequest.contract_address
    } else if (payload.transactionType === 'evm') {
        approveTo = payload.transactionRequest.to as string
    } else {
        // BTC
        approveTo = AddressZero
    }
    return {
        kind: 'unwrap',
        route: [params.inTokenAmount.token, params.outToken],
        tokenAmountOut: amountOut,
        approveTo,
        ...payload,
    }
}

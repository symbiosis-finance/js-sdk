import { TokenAmount, WETH } from '../../entities'
import { Weth__factory } from '../contracts'
import { getFunctionSelector } from '../tron'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult } from './types'
import {AddressZero} from "@ethersproject/constants/lib/addresses";

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

    const functionSelector = getFunctionSelector(wethInterface.getFunction('deposit'))

    const payload = preparePayload({
        functionSelector,
        chainId,
        fromAddress: params.fromAddress,
        toAddress: weth.address,
        value: inTokenAmount.raw.toString(),
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
        kind: 'wrap',
        route: [inTokenAmount.token, weth],
        tokenAmountOut: amountOut,
        approveTo,
        ...payload,
    }
}

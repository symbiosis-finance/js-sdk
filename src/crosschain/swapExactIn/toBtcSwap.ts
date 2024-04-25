import { networks, address } from 'bitcoinjs-lib'

import { ChainId } from '../../constants'
import { TokenAmount } from '../../entities'
import { Synthesis__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { outToken, inTokenAmount } = context

    const isThorChainSwapSupported = outToken.chainId === ChainId.BTC_MAINNET

    let isNativeSwapSupported = false

    if (inTokenAmount.token.chain?.id) {
        // if symBtc contract deployed on chain we could Burn and exit to native BTC
        isNativeSwapSupported = !!context.symbiosis.chainConfig(inTokenAmount.token.chain?.id).symBtc
    }

    return isThorChainSwapSupported || isNativeSwapSupported
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount, outToken } = context

    const isThorChainSwap = false

    // Thor chain flow
    const omniPool = context.symbiosis.config.omniPools[0]
    const zappingThor = context.symbiosis.newZappingThor(omniPool)

    const result = await zappingThor.exactIn({
        tokenAmountIn: inTokenAmount,
        from: context.fromAddress,
        to: context.toAddress,
        slippage: context.slippage,
        deadline: context.deadline,
    })

    const payload = {
        transactionType: result.type,
        transactionRequest: result.transactionRequest,
    } as SwapExactInTransactionPayload

    return {
        kind: 'crosschain-swap',
        ...result,
        ...payload,
    }
}

// --- start utility functions
function getNetwork(chain: string): networks.Network | undefined {
    return {
        mainnet: networks.bitcoin,
        testnet3: networks.testnet,
    }[chain]
}

export function getPkScript(addr: string, chain: string): Buffer {
    return address.toOutputScript(addr, getNetwork(chain))
}

export function getAddress(pkScript: string, chain: string): string {
    return address.fromOutputScript(Buffer.from(pkScript.substring(2), 'hex'), getNetwork(chain))
}
// --- end  utility functions

// export async function _burnSyntheticBtc({inTokenAmount, outToken, symbiosis, fromAddress}: SwapExactInParams): Promise<SwapExactInResult> {
//     const synthesisInterface = Synthesis__factory.createInterface()

//     const amountOut = new TokenAmount(outToken, inTokenAmount.raw)
//     const clientId = '0x1234560000000000000000000000000000000000000000000000000000000000'

//     const callData = synthesisInterface.encodeFunctionData('burnSyntheticTokenBTC', [
//         0,
//         inTokenAmount.raw,
//         getPkScript(to, "testnet3"), // [TODO]: Change it from toggle networks
//         symbiosis.symBtc.getSyntToken(outToken.chain?.id),
//         clientId
//     ])

//     const callData =''

//     const functionSelector =''

//     const payload = preparePayload({
//         functionSelector,
//         chainId: inTokenAmount.token.chainId,
//         fromAddress: fromAddress,
//         toAddress: inTokenAmount.token.address,
//         callData,
//     })

//     return {
//         kind: 'to-btc-swap',
//         route: [inTokenAmount.token, outToken],
//         tokenAmountOut: amountOut,
//         approveTo: payload.transactionRequest.to
//         ...payload,
//     }
// }

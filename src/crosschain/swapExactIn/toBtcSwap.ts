import { networks, address, Network } from 'bitcoinjs-lib'

import { ChainId } from '../../constants'
import { TokenAmount } from '../../entities'
import { Synthesis__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { getFunctionSelector } from '../tron'

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
    const { inTokenAmount } = context

    const isNativeSwapSupported = !!context.symbiosis.chainConfig(inTokenAmount.token.chain!.id).symBtc

    if (isNativeSwapSupported) {
        return _burnSyntheticBtc(context)
    }

    // Thor chain fallback
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

// --- start BTC utility functions ---

export const BTC_NETWORKS: Record<ChainId.BTC_MAINNET | ChainId.BTC_TESTNET, Network> = {
    [ChainId.BTC_MAINNET]: networks.bitcoin,
    [ChainId.BTC_TESTNET]: networks.testnet,
}

export function getPkScript(addr: string, btcChain: Network): Buffer {
    return address.toOutputScript(addr, btcChain)
}

export function getAddress(pkScript: string, btcChain: Network): string {
    return address.fromOutputScript(Buffer.from(pkScript.substring(2), 'hex'), btcChain)
}
// --- end  BTC utility functions ---

export async function _burnSyntheticBtc({
    inTokenAmount,
    outToken,
    symbiosis,
    fromAddress,
    toAddress,
}: SwapExactInParams): Promise<SwapExactInResult> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const symBtcContract = symbiosis.symBtc(inTokenAmount.token.chainId)

    const syntheticBtcTokenAddress = await symBtcContract.getSyntToken()
    const amountOut = new TokenAmount(outToken, inTokenAmount.raw)
    // partner's id to identify them
    const clientId = '0x0000000000000000000000000000000000000000000000000000000000000000'
    // const minBtcFee = await symbiosis.synthesis?.minFeeBTC() // uncomment
    const minBtcFee = '12500' //[TODO]: remove

    //@ts-ignore
    const callData = synthesisInterface.encodeFunctionData('burnSyntheticTokenBTC', [
        0,
        inTokenAmount.raw.toString(),
        getPkScript(toAddress, BTC_NETWORKS[ChainId.BTC_TESTNET]), // [TODO]: Change it for mainnet
        syntheticBtcTokenAddress,
        clientId,
    ])

    console.log('--caldata to btc swap ---', callData)


    const payload = preparePayload({
        chainId: inTokenAmount.token.chainId,
        fromAddress,
        toAddress: await symBtcContract.synthesis(),
        callData,
    })

    const totalTokenAmountOut = amountOut.subtract(new TokenAmount(outToken, minBtcFee))

    return {
        kind: 'to-btc-swap',
        route: [inTokenAmount.token, outToken],
        tokenAmountOut: totalTokenAmountOut,
        approveTo: payload.transactionRequest.to,
        fee: new TokenAmount(inTokenAmount.token, minBtcFee),
        ...payload,
    }
}

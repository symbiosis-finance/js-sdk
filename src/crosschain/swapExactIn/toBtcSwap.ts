import { networks, address, Network } from 'bitcoinjs-lib'

import { ChainId } from '../../constants'
import { TokenAmount } from '../../entities'
import { Synthesis__factory } from '../contracts'
import { preparePayload } from './preparePayload'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { isBtc } from '../utils'

export function isToBtcSwapSupported(context: SwapExactInParams): boolean {
    const { outToken } = context

    const isThorChainSwapSupported = outToken.chainId === ChainId.BTC_MAINNET

    const isNativeSwapSupported = outToken.chainId === ChainId.BTC_MAINNET

    return isThorChainSwapSupported || isNativeSwapSupported
}

export async function toBtcSwap(context: SwapExactInParams): Promise<SwapExactInResult> {
    const { inTokenAmount } = context

    const isNativeSwapSupported = !!context.symbiosis.chainConfig(inTokenAmount.token.chain!.id).symBtc

    if (isNativeSwapSupported) {
        return _burnSyntheticBtc(context)
    }

    // ThorChain fallback
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
type BtcChainId = ChainId.BTC_MAINNET | ChainId.BTC_TESTNET

export const BTC_NETWORKS: Record<BtcChainId, Network> = {
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
    const chainIdOut = outToken.chainId
    if (!isBtc(chainIdOut)) {
        throw new Error('Destination is not Bitcoin')
    }

    const chainId = inTokenAmount.token.chainId
    const synthesisInterface = Synthesis__factory.createInterface()
    const symBtcContract = symbiosis.symBtc(chainId)
    const syntheticBtcTokenAddress = await symBtcContract.getSyntToken()

    if (inTokenAmount.token.address.toLowerCase() !== syntheticBtcTokenAddress.toLowerCase()) {
        throw new Error('Incorrect synthetic BTC address')
    }

    const amountOut = new TokenAmount(outToken, inTokenAmount.raw)
    const synthesis = symbiosis.synthesis(chainId)

    const to = getPkScript(toAddress, BTC_NETWORKS[chainIdOut as BtcChainId])

    const minBtcFee = await synthesis.minFeeBTC()

    const callData = synthesisInterface.encodeFunctionData('burnSyntheticTokenBTC', [
        minBtcFee.toString(), // _stableBridgingFee must be >= minBtcFee
        inTokenAmount.raw.toString(), // _amount
        to, // _to
        inTokenAmount.token.address, // _stoken
        symbiosis.clientId, // _clientID
    ])

    const payload = preparePayload({
        chainId,
        fromAddress,
        toAddress: synthesis.address,
        callData,
    })
    const fee = new TokenAmount(outToken, minBtcFee.toString())
    const totalTokenAmountOut = amountOut.subtract(fee)

    return {
        kind: 'to-btc-swap',
        route: [inTokenAmount.token, outToken],
        tokenAmountOut: totalTokenAmountOut,
        approveTo: payload.transactionRequest.to,
        fee,
        ...payload,
    }
}

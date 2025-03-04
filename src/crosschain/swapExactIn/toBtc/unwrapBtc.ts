import { GAS_TOKEN, Percent, TokenAmount } from '../../../entities'
import { initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BTC_NETWORKS, getPkScript } from '../../chainUtils/btc'
import { SwapExactInParams, SwapExactInResult, SwapExactInTransactionPayload } from '../../types'
import { getToBtcFee } from '../../chainUtils/btc'
import { BIPS_BASE } from '../../constants'

initEccLib(ecc)

export async function unwrapBtc({ symbiosis, tokenAmountIn, to }: SwapExactInParams): Promise<SwapExactInResult> {
    let syBtc = tokenAmountIn.token
    if (!syBtc.chainFromId) {
        const found = symbiosis.tokens().find((token) => {
            return token.equals(syBtc) && token.isSynthetic
        })
        if (found) {
            syBtc = found
        }
    }
    if (!syBtc.chainFromId) {
        throw new Error('syBtc is not synthetic')
    }

    const network = BTC_NETWORKS[syBtc.chainFromId]
    if (!network) {
        throw new Error('Unknown BTC network')
    }
    const btc = GAS_TOKEN[syBtc.chainFromId]

    const bitcoinAddress = getPkScript(to, network)

    const synthesis = symbiosis.synthesis(syBtc.chainId)
    const minBtcFee = await getToBtcFee(tokenAmountIn, synthesis, symbiosis.cache)

    const data = synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
        minBtcFee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
        tokenAmountIn.raw.toString(),
        bitcoinAddress, // _to
        syBtc.address, // _stoken
        symbiosis.clientId, // _clientID
    ])

    const tokenAmountOut = new TokenAmount(btc, tokenAmountIn.subtract(minBtcFee).raw)

    const payload: SwapExactInTransactionPayload = {
        transactionType: 'evm',
        transactionRequest: {
            chainId: syBtc.chainId,
            to: synthesis.address,
            data,
        },
    }
    return {
        ...payload,
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut,
        priceImpact: new Percent('0', BIPS_BASE),
        amountInUsd: tokenAmountIn,
        approveTo: synthesis.address,
        routes: [
            {
                provider: 'symbiosis',
                tokens: [syBtc, btc],
            },
        ],
        fees: [
            {
                provider: 'symbiosis',
                value: minBtcFee,
                description: 'Unwrap BTC fee',
            },
        ],
        kind: 'crosschain-swap',
    }
}

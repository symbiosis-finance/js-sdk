import { GAS_TOKEN, Percent, TokenAmount } from '../entities'
import { initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { Symbiosis } from './symbiosis'
import { BTC_NETWORKS, getPkScript } from './zappingBtc'
import { SwapExactInResult, SwapExactInTransactionPayload } from './types'

initEccLib(ecc)

interface BurnBtcParams {
    tokenAmountIn: TokenAmount
    to: string
}

export class UnwrapBtc {
    constructor(private symbiosis: Symbiosis) {}

    public async exactIn({ tokenAmountIn, to }: BurnBtcParams): Promise<SwapExactInResult> {
        const { token: sBtc } = tokenAmountIn
        if (!sBtc.chainFromId) {
            throw new Error('sBtc is not synthetic')
        }

        const network = BTC_NETWORKS[sBtc.chainFromId]
        if (!network) {
            throw new Error('Unknown BTC network')
        }
        const btc = GAS_TOKEN[sBtc.chainFromId]

        const bitcoinAddress = getPkScript(to, network)

        const synthesis = this.symbiosis.synthesis(sBtc.chainId)
        const minBtcFeeRaw = await synthesis.syntToMinFeeBTC(sBtc.address)
        const minBtcFee = new TokenAmount(sBtc, minBtcFeeRaw.toString())

        const data = synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
            minBtcFee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
            tokenAmountIn.raw.toString(),
            bitcoinAddress, // _to
            sBtc.address, // _stoken
            this.symbiosis.clientId, // _clientID
        ])

        const tokenAmountOut = new TokenAmount(btc, tokenAmountIn.subtract(minBtcFee).raw)

        const payload: SwapExactInTransactionPayload = {
            transactionType: 'evm',
            transactionRequest: {
                chainId: sBtc.chainId,
                to: synthesis.address,
                data,
            },
        }
        return {
            save: new TokenAmount(sBtc, '0'),
            fee: minBtcFee,
            tokenAmountOut,
            tokenAmountOutMin: tokenAmountOut,
            route: [sBtc, btc],
            priceImpact: new Percent('0', '0'),
            amountInUsd: tokenAmountIn,
            approveTo: synthesis.address,
            ...payload,
            routes: [],
            fees: [],
            kind: 'crosschain-swap',
        }
    }
}

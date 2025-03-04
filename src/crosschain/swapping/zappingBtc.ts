import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { MulticallRouter, Synthesis } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BTC_NETWORKS, getPkScript, getToBtcFee } from '../chainUtils/btc'
import { SwapExactInResult } from '../types'
import { isEvmChainId } from '../chainUtils'

initEccLib(ecc)

interface ZappingBtcExactInParams {
    tokenAmountIn: TokenAmount
    syBtc: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
    transitTokenIn: Token
    transitTokenOut: Token
}

export class ZappingBtc extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: Buffer

    protected sBtc!: Token
    protected minBtcFee!: TokenAmount
    protected synthesis!: Synthesis
    protected evmTo!: string

    protected async doPostTransitAction(): Promise<void> {
        const amount = this.tradeC ? this.tradeC.amountOut : this.transit.amountOut
        this.minBtcFee = await getToBtcFee(amount, this.synthesis, this.symbiosis.cache)
    }

    public async exactIn({
        tokenAmountIn,
        syBtc,
        from,
        to,
        slippage,
        deadline,
        transitTokenIn,
        transitTokenOut,
    }: ZappingBtcExactInParams): Promise<SwapExactInResult> {
        if (!syBtc.chainFromId) {
            throw new Error('sBtc is not synthetic')
        }
        const network = BTC_NETWORKS[syBtc.chainFromId]
        if (!network) {
            throw new Error('Unknown BTC network')
        }
        const btc = GAS_TOKEN[syBtc.chainFromId]

        this.bitcoinAddress = getPkScript(to, network)
        this.sBtc = syBtc

        this.multicallRouter = this.symbiosis.multicallRouter(syBtc.chainId)

        this.synthesis = this.symbiosis.synthesis(syBtc.chainId)

        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = this.symbiosis.config.revertableAddress.default
        }
        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: syBtc,
            from,
            to: this.evmTo,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
        })

        const tokenAmountOut = new TokenAmount(btc, result.tokenAmountOut.subtract(this.minBtcFee).raw)
        const tokenAmountOutMin = new TokenAmount(btc, result.tokenAmountOutMin.subtract(this.minBtcFee).raw)

        return {
            ...result,
            tokenAmountOut,
            tokenAmountOutMin,
            fees: [
                ...result.fees,
                {
                    provider: 'symbiosis',
                    description: 'BTC fee',
                    value: this.minBtcFee,
                },
            ],
            routes: [
                ...result.routes,
                {
                    provider: 'symbiosis',
                    tokens: [syBtc, btc],
                },
            ],
        }
    }

    protected tradeCTo(): string {
        return this.multicallRouter.address
    }

    protected finalReceiveSide(): string {
        return this.multicallRouter.address
    }

    protected finalCalldata(): string | [] {
        return this.buildMulticall()
    }

    protected finalOffset(): number {
        return 36
    }

    private buildMulticall() {
        const callDatas = []
        const receiveSides = []
        const path = []
        const offsets = []
        const amount = this.transit.amountOut

        if (this.tradeC) {
            callDatas.push(this.tradeC.callData)
            receiveSides.push(this.tradeC.routerAddress)
            path.push(this.tradeC.tokenAmountIn.token.address)
            offsets.push(this.tradeC.callDataOffset!)
        }

        const burnCalldata = this.synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
            this.minBtcFee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
            '0', // _amount will be patched
            this.bitcoinAddress, // _to
            this.sBtc.address, // _stoken
            this.symbiosis.clientId, // _clientID
        ])

        callDatas.push(burnCalldata)
        receiveSides.push(this.synthesis.address)
        path.push(this.sBtc.address)
        offsets.push(68)

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.evmTo,
        ])
    }
}

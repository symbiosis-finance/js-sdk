import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { MulticallRouter, Synthesis } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { Network, networks, address, initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { getToBtcFee } from '../chainUtils/btc'
import { SwapExactInResult } from '../types'
import { ChainId } from '../../constants'

initEccLib(ecc)

interface ZappingBtcExactInParams {
    tokenAmountIn: TokenAmount
    syBtc: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
    transitTokenIn?: Token
    transitTokenOut?: Token
}

export const BTC_NETWORKS: Partial<Record<ChainId, Network>> = {
    [ChainId.BTC_MAINNET]: networks.bitcoin,
    [ChainId.BTC_MUTINY]: networks.testnet,
    [ChainId.BTC_TESTNET4]: networks.testnet,
}

export function getPkScript(addr: string, btcChain: Network): Buffer {
    return address.toOutputScript(addr, btcChain)
}

export function getAddress(pkScript: string, btcChain: Network): string {
    return address.fromOutputScript(Buffer.from(pkScript.substring(2), 'hex'), btcChain)
}

export class ZappingBtc extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: Buffer

    protected sBtc!: Token
    protected minBtcFee!: TokenAmount
    protected synthesis!: Synthesis

    protected async doPostTransitAction() {}

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
        this.minBtcFee = await getToBtcFee(syBtc, this.synthesis, this.symbiosis.dataProvider)

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: syBtc,
            from,
            to: from,
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
        const amount = this.getTradeCAmountIn()

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
            this.from,
        ])
    }
}

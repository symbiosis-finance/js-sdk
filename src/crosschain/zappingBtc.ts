import { ChainId } from '../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../entities'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { MulticallRouter, Synthesis } from './contracts'
import { OneInchProtocols } from './trade/oneInchTrade'
import { Network, networks, address, initEccLib } from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'

export interface ZappingThorExactInParams {
    tokenAmountIn: TokenAmount
    sBtc: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export const BTC_NETWORKS: Partial<Record<ChainId, Network>> = {
    [ChainId.BTC_MAINNET]: networks.bitcoin,
    [ChainId.BTC_TESTNET]: networks.testnet,
}

export function getPkScript(addr: string, btcChain: Network): Buffer {
    initEccLib(ecc)

    return address.toOutputScript(addr, btcChain)
}

export function getAddress(pkScript: string, btcChain: Network): string {
    initEccLib(ecc)

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
        sBtc,
        from,
        to,
        slippage,
        deadline,
    }: ZappingThorExactInParams): Promise<CrosschainSwapExactInResult> {
        if (!sBtc.chainFromId) {
            throw new Error('sBtc is not synthetic')
        }
        const network = BTC_NETWORKS[sBtc.chainFromId]
        if (!network) {
            throw new Error('Unknown BTC network')
        }
        const btc = GAS_TOKEN[sBtc.chainFromId]

        this.bitcoinAddress = getPkScript(to, network)
        this.sBtc = sBtc

        this.multicallRouter = this.symbiosis.multicallRouter(sBtc.chainId)

        this.synthesis = this.symbiosis.synthesis(sBtc.chainId)
        const minBtcFeeRaw = await this.synthesis.syntToMinFeeBTC(sBtc.address)
        this.minBtcFee = new TokenAmount(sBtc, minBtcFeeRaw.toString())

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: sBtc,
            from,
            to: from,
            slippage,
            deadline,
        })

        const tokenAmountOut = new TokenAmount(btc, result.tokenAmountOut.subtract(this.minBtcFee).raw)

        // // >> for display route purposes only
        result.route.push(new Token({ ...sBtc, chainFromId: undefined }))

        return {
            ...result,
            tokenAmountOut,
            tokenAmountOutMin: tokenAmountOut,
            extraFee: this.minBtcFee,
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

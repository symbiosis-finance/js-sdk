import { ChainId } from '../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../entities'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { MulticallRouter, Synthesis } from './contracts'
import { OneInchProtocols } from './trade/oneInchTrade'
import { address, Network, networks } from 'bitcoinjs-lib'

export interface ZappingThorExactInParams {
    tokenAmountIn: TokenAmount
    sBtc: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

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

export class ZappingNativeBtc extends BaseSwapping {
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
        const chainIdOut = ChainId.BTC_TESTNET // FIXME
        this.bitcoinAddress = getPkScript(to, BTC_NETWORKS[chainIdOut as BtcChainId])
        this.sBtc = sBtc

        this.multicallRouter = this.symbiosis.multicallRouter(sBtc.chainId)

        this.synthesis = this.symbiosis.synthesis(sBtc.chainId)
        const minBtcFeeRaw = await this.synthesis.minFeeBTC()
        this.minBtcFee = new TokenAmount(sBtc, minBtcFeeRaw.toString())

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: sBtc,
            from,
            to: from,
            slippage,
            deadline,
        })

        const tokenAmountOut = result.tokenAmountOut.subtract(this.minBtcFee)

        // >> for display route purposes only
        result.route.push(new Token({ ...sBtc, chainId: ChainId.BTC_MAINNET }))
        result.route.push(BTC)

        return {
            ...result,
            tokenAmountOut,
            tokenAmountOutMin: tokenAmountOut,
            // outTradeType: 'thor-chain',
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
        offsets.push(100)

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

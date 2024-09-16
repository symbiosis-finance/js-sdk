import { ChainId } from '../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../entities'
import { BaseSwapping, BaseSwappingExactInResult } from './baseSwapping'
import { MulticallRouter, Synthesis } from './contracts'
import { OneInchProtocols } from './trade/oneInchTrade'
import { Network, networks, address, initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { DataProvider } from './dataProvider'
import { getFastestFee } from './mempool'
import { BigNumber } from 'ethers'

initEccLib(ecc)

interface ZappingBtcExactInParams {
    tokenAmountIn: TokenAmount
    sBtc: Token
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
        sBtc,
        from,
        to,
        slippage,
        deadline,
        transitTokenIn,
        transitTokenOut,
    }: ZappingBtcExactInParams): Promise<BaseSwappingExactInResult> {
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
        this.minBtcFee = await this.getBtcFee(sBtc, this.symbiosis.dataProvider)

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: sBtc,
            from,
            to: from,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
        })

        const tokenAmountOut = new TokenAmount(btc, result.tokenAmountOut.subtract(this.minBtcFee).raw)

        // >> for display route purposes only
        if (result.route.length > 0) {
            result.route[result.route.length - 1] = new Token({
                ...sBtc,
                chainId: sBtc.chainFromId,
                chainFromId: undefined,
            })
        }

        return {
            ...result,
            tokenAmountOut,
            tokenAmountOutMin: tokenAmountOut,
            extraFee: this.minBtcFee,
        }
    }

    protected async getBtcFee(sBtc: Token, dataProvider: DataProvider) {
        let fee = await dataProvider.get(
            ['syntToMinFeeBTC', this.synthesis.address, sBtc.address],
            async () => {
                return this.synthesis.syntToMinFeeBTC(sBtc.address)
            },
            600 // 10 minutes
        )

        try {
            const recommendedFee = await dataProvider.get(
                ['getFastestFee'],
                async () => {
                    const fastestFee = await getFastestFee()
                    return BigNumber.from(fastestFee * 100)
                },
                60 // 1 minute
            )
            if (recommendedFee.gt(fee)) {
                fee = recommendedFee
            }
        } catch {
            /* nothing */
        }
        return new TokenAmount(sBtc, fee.toString())
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

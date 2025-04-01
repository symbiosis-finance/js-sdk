import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { MulticallRouter, Synthesis } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BTC_NETWORKS, getPkScript, getToBtcFee } from '../chainUtils/btc'
import { FeeItem, MultiCallItem, SwapExactInResult } from '../types'
import { isEvmChainId } from '../chainUtils'
import { getPartnerFeeCall } from '../feeCall/getPartnerFeeCall'
import { BytesLike } from 'ethers'
import { getVolumeFeeCall } from '../feeCall/getVolumeFeeCall'

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
    partnerAddress?: string
}

export class ZappingBtc extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: Buffer

    protected syBtc!: Token
    protected minBtcFee!: TokenAmount
    protected synthesis!: Synthesis
    protected evmTo!: string
    protected partnerFeeCall?: MultiCallItem
    protected partnerAddress?: string
    protected volumeFeeCall?: MultiCallItem

    protected async doPostTransitAction(): Promise<void> {
        const amount = this.tradeC ? this.tradeC.amountOut : this.transit.amountOut
        const amountMin = this.tradeC ? this.tradeC.amountOutMin : this.transit.amountOutMin
        this.minBtcFee = await getToBtcFee(amount, this.synthesis, this.symbiosis.cache)
        this.partnerFeeCall = await getPartnerFeeCall({
            symbiosis: this.symbiosis,
            amountIn: amount,
            amountInMin: amountMin,
            partnerAddress: this.partnerAddress,
        })
        this.volumeFeeCall = await getVolumeFeeCall({
            amountIn: amount,
            amountInMin: amountMin,
        })
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
        partnerAddress,
    }: ZappingBtcExactInParams): Promise<SwapExactInResult> {
        if (!syBtc.chainFromId) {
            throw new Error('syBtc is not synthetic')
        }
        const network = BTC_NETWORKS[syBtc.chainFromId]
        if (!network) {
            throw new Error('Unknown BTC network')
        }
        const btc = GAS_TOKEN[syBtc.chainFromId]

        this.bitcoinAddress = getPkScript(to, network)
        this.syBtc = syBtc

        const chainId = syBtc.chainId

        this.partnerAddress = partnerAddress

        this.multicallRouter = this.symbiosis.multicallRouter(chainId)
        this.synthesis = this.symbiosis.synthesis(chainId)

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

        let amountOut = result.tokenAmountOut
        let amountOutMin = result.tokenAmountOutMin
        let partnerFee = new TokenAmount(syBtc, '0')
        if (this.partnerFeeCall) {
            amountOut = this.partnerFeeCall.amountOut
            amountOutMin = this.partnerFeeCall.amountOutMin
            if (this.partnerFeeCall.fees.length > 0) {
                partnerFee = this.partnerFeeCall.fees[0].value
            }
        }
        let volumeFee = new TokenAmount(syBtc, '0')
        if (this.volumeFeeCall) {
            amountOut = this.volumeFeeCall.amountOut
            amountOutMin = this.volumeFeeCall.amountOutMin
            if (this.volumeFeeCall.fees.length > 0) {
                volumeFee = this.volumeFeeCall.fees[0].value
            }
        }

        const tokenAmountOut = new TokenAmount(btc, amountOut.subtract(this.minBtcFee).raw)
        const tokenAmountOutMin = new TokenAmount(btc, amountOutMin.subtract(this.minBtcFee).raw)

        const fees = [
            ...result.fees,
            {
                provider: 'symbiosis',
                description: 'BTC fee',
                value: this.minBtcFee,
            } as FeeItem,
        ]

        if (partnerFee) {
            fees.push({
                provider: 'symbiosis',
                description: 'Partner fee',
                value: partnerFee,
            } as FeeItem)
        }

        if (volumeFee) {
            fees.push({
                provider: 'symbiosis',
                description: 'Volume fee',
                value: volumeFee,
            } as FeeItem)
        }

        return {
            ...result,
            tokenAmountOut,
            tokenAmountOutMin,
            fees,
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
        const callDatas: BytesLike[] = []
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

        if (this.partnerFeeCall) {
            callDatas.push(this.partnerFeeCall.data)
            receiveSides.push(this.partnerFeeCall.to)
            path.push(this.partnerFeeCall.amountIn.token.address)
            offsets.push(this.partnerFeeCall.offset)
        }

        if (this.volumeFeeCall) {
            callDatas.push(this.volumeFeeCall.data)
            receiveSides.push(this.volumeFeeCall.to)
            path.push(this.volumeFeeCall.amountIn.token.address)
            offsets.push(this.volumeFeeCall.offset)
        }

        const burnCalldata = this.synthesis.interface.encodeFunctionData('burnSyntheticTokenBTC', [
            this.minBtcFee.raw.toString(), // _stableBridgingFee must be >= minBtcFee
            '0', // _amount will be patched
            this.bitcoinAddress, // _to
            this.syBtc.address, // _stoken
            this.symbiosis.clientId, // _clientID
        ])

        callDatas.push(burnCalldata)
        receiveSides.push(this.synthesis.address)
        path.push(this.syBtc.address)
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

import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { MulticallRouter, PartnerFeeCollector, PartnerFeeCollector__factory, Synthesis } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { initEccLib } from 'bitcoinjs-lib'
import ecc from '@bitcoinerlab/secp256k1'
import { BTC_NETWORKS, getPkScript, getToBtcFee } from '../chainUtils/btc'
import { SwapExactInResult } from '../types'
import { isEvmChainId } from '../chainUtils'
import { BigNumber } from 'ethers'

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
    protected partnerFeeCollector?: PartnerFeeCollector
    protected partnerAddress?: string

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

        const partnerFeeCollectorAddress = this.symbiosis.chainConfig(chainId).partnerFeeCollector
        if (partnerFeeCollectorAddress) {
            this.partnerFeeCollector = PartnerFeeCollector__factory.connect(
                partnerFeeCollectorAddress,
                this.symbiosis.getProvider(chainId)
            )
        }

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

        if (this.partnerFeeCollector && partnerAddress) {
            const WAD = BigNumber.from(10).pow(18)
            const { isActive, feeRate } = await this.symbiosis.cache.get(
                ['partnerFeeCollector', this.partnerFeeCollector.address, chainId.toString(), partnerAddress],
                () => this.partnerFeeCollector!.callStatic.partners(partnerAddress),
                60 * 60 // 1 hour
            )
            if (isActive && !feeRate.isZero()) {
                const fixedFee = await this.symbiosis.cache.get(
                    [
                        'partnerFeeCollector',
                        this.partnerFeeCollector.address,
                        chainId.toString(),
                        partnerAddress,
                        syBtc.address,
                    ],
                    () => this.partnerFeeCollector!.callStatic.fixedFee(partnerAddress, syBtc.address),
                    60 * 60 // 1 hour
                )

                const amountIn = result.tokenAmountOut
                const amountInBn = BigNumber.from(amountIn.raw.toString())
                const percentageFee = amountInBn.mul(feeRate).div(WAD)
                const totalFee = percentageFee.add(fixedFee)
                amountOut = new TokenAmount(amountIn.token, amountInBn.sub(totalFee).toString())

                const amountInMinBn = BigNumber.from(result.tokenAmountOutMin.raw.toString())
                const percentageFeeMin = amountInMinBn.mul(feeRate).div(WAD)
                const totalFeeMin = percentageFeeMin.add(fixedFee)
                amountOutMin = new TokenAmount(amountIn.token, amountInMinBn.sub(totalFeeMin).toString())
            }
        }

        const tokenAmountOut = new TokenAmount(btc, amountOut.subtract(this.minBtcFee).raw)
        const tokenAmountOutMin = new TokenAmount(btc, amountOutMin.subtract(this.minBtcFee).raw)

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

        if (this.partnerFeeCollector && this.partnerAddress) {
            const data = this.partnerFeeCollector.interface.encodeFunctionData('collectFee', [
                '0', // _amount will be patched
                this.syBtc.address,
                this.partnerAddress,
            ])

            callDatas.push(data)
            receiveSides.push(this.partnerFeeCollector.address)
            path.push(this.syBtc.address)
            offsets.push(36)
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

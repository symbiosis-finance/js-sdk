import { Quote, SwapSDK, VaultSwapResponse } from '@chainflip/sdk/swap'

import { TokenAmount } from '../../../entities'
import { BaseSwapping } from '../../swapping'
import { MulticallRouter } from '../../contracts'
import { OneInchProtocols } from '../../trade/oneInchTrade'
import { Error } from '../../error'
import { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import { isEvmChainId } from '../../chainUtils'

import { ChainFlipBrokerAccount, ChainFlipBrokerFeeBps, checkMinAmount, getChainFlipFee } from './utils'
import { ChainFlipConfig } from './types'

export interface ZappingChainFlipExactInParams {
    tokenAmountIn: TokenAmount
    config: ChainFlipConfig
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export class ZappingCrossChainChainFlip extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected chainFlipSdk: SwapSDK
    protected chainFlipQuote!: Quote
    protected chainFlipVaultSwapResponse!: VaultSwapResponse
    protected config!: ChainFlipConfig
    protected evmTo!: string
    protected dstAddress: string

    public constructor(context: SwapExactInParams, omniPoolConfig: OmniPoolConfig) {
        const { symbiosis, to } = context
        super(symbiosis, omniPoolConfig)

        this.dstAddress = to

        this.chainFlipSdk = new SwapSDK({
            network: 'mainnet',
            enabledFeatures: { dca: true },
        })
    }

    protected async doPostTransitAction() {
        checkMinAmount(this.transit.amountOut)

        const { src, dest } = this.config
        try {
            const { quotes } = await this.chainFlipSdk.getQuoteV2({
                amount: this.transit.amountOut.raw.toString(),
                srcChain: src.chain,
                srcAsset: src.asset,
                destChain: dest.chain,
                destAsset: dest.asset,
                isVaultSwap: true,
                brokerCommissionBps: ChainFlipBrokerFeeBps,
            })
            const quote = quotes.find((quote) => quote.type === 'REGULAR')
            if (!quote) {
                throw new Error('There is no REGULAR quote found')
            }

            this.chainFlipQuote = quote

            // Encode vault swap transaction data
            this.chainFlipVaultSwapResponse = await this.chainFlipSdk.encodeVaultSwapData({
                quote,
                destAddress: this.dstAddress,
                fillOrKillParams: {
                    slippageTolerancePercent: this.chainFlipQuote.recommendedSlippageTolerancePercent,
                    refundAddress: this.evmTo,
                    retryDurationBlocks: 100,
                },
                brokerAccount: ChainFlipBrokerAccount,
                brokerCommissionBps: ChainFlipBrokerFeeBps,
            })
        } catch (e) {
            console.error(e)
            throw new Error('Chainflip error')
        }
    }

    public async exactIn({
        tokenAmountIn,
        config,
        from,
        slippage,
        deadline,
    }: ZappingChainFlipExactInParams): Promise<SwapExactInResult> {
        const chainFlipTokenIn = config.tokenIn
        this.config = config
        this.multicallRouter = this.symbiosis.multicallRouter(chainFlipTokenIn.chainId)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(chainFlipTokenIn.chainId, this.omniPoolConfig)
        if (transitTokenIn.equals(transitTokenOut)) {
            throw new Error('Same transit token')
        }
        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = this.symbiosis.config.refundAddress
        }
        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: chainFlipTokenIn,
            from,
            to: this.evmTo,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
        })

        const { egressAmount, includedFees } = this.chainFlipQuote
        const { usdcFeeToken, solFeeToken, btcFeeToken } = getChainFlipFee(includedFees)
        const amountOut = new TokenAmount(config.tokenOut, egressAmount)

        return {
            ...result,
            tokenAmountOut: amountOut,
            tokenAmountOutMin: amountOut,
            routes: [
                ...result.routes,
                {
                    provider: 'chainflip-bridge',
                    tokens: [chainFlipTokenIn, amountOut.token],
                },
            ],
            fees: [
                ...result.fees,
                {
                    provider: 'chainflip-bridge',
                    description: 'ChainFlip fee',
                    value: usdcFeeToken,
                },
                {
                    provider: 'chainflip-bridge',
                    description: 'ChainFlip fee',
                    value: solFeeToken,
                },
                {
                    provider: 'chainflip-bridge',
                    description: 'ChainFlip fee',
                    value: btcFeeToken,
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

        const { chain } = this.chainFlipVaultSwapResponse
        if (chain !== 'Arbitrum' && chain !== 'Ethereum') {
            throw new Error(`Incorrect ChainFlip source chain: ${chain}`)
        }
        const { calldata, to, sourceTokenAddress } = this.chainFlipVaultSwapResponse
        callDatas.push(calldata)
        receiveSides.push(to)
        path.push(sourceTokenAddress!)
        offsets.push(164)

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

import { Quote, SwapSDK, VaultSwapResponse } from '@chainflip/sdk/swap'

import { TokenAmount } from '../../../entities'
import { BaseSwapping } from '../../swapping'
import { MulticallRouter } from '../../contracts'
import { OneInchProtocols } from '../../trade/oneInchTrade'
import { Error, ErrorCode } from '../../error'
import { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import { isEvmChainId } from '../../chainUtils'

import { getChainFlipFee } from './utils'
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
        const { src, dest } = this.config
        try {
            const { quotes } = await this.chainFlipSdk.getQuoteV2({
                amount: this.transit.amountOut.raw.toString(),
                srcChain: src.chain,
                srcAsset: src.asset,
                destChain: dest.chain,
                destAsset: dest.asset,
                isVaultSwap: true,
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
                    refundAddress: '0xd99ac0681b904991169a4f398B9043781ADbe0C3',
                    retryDurationBlocks: 100,
                },
            })
        } catch (e) {
            console.error(e)
            if ((e as unknown as { status: number }).status === 400) {
                throw new Error('The min swap amount is $10', ErrorCode.MIN_CHAINFLIP_AMOUNT_IN)
            } else {
                throw new Error('Chainflip error')
            }
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
            this.evmTo = this.symbiosis.config.revertableAddress.default
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

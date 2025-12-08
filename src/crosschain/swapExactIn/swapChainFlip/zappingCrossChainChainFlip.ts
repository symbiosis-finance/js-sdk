import type { Quote, RegularQuote, VaultSwapResponse } from '@chainflip/sdk/swap'
import { SwapSDK } from '@chainflip/sdk/swap'

import { TokenAmount } from '../../../entities'
import { getMinAmount, isEvmChainId } from '../../chainUtils'
import type { MulticallRouter } from '../../contracts'
import { ChainFlipError } from '../../sdkError'
import { BaseSwapping } from '../../swapping'
import type { OneInchProtocols } from '../../trade/oneInchTrade'
import type { Address, EvmAddress, OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import type { ChainFlipConfig } from './types'
import { ChainFlipBrokerAccount, ChainFlipBrokerFeeBps, checkMinAmount, getChainFlipFee } from './utils'

export interface ZappingChainFlipExactInParams {
    tokenAmountIn: TokenAmount
    config: ChainFlipConfig
    from: Address
    to: Address
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
    protected evmTo!: Address // should be EvmAddress actually
    protected dstAddress: string

    public constructor(context: SwapExactInParams, omniPoolConfig: OmniPoolConfig) {
        const { symbiosis, to, partnerAddress } = context
        super(symbiosis, omniPoolConfig)

        this.dstAddress = to
        this.partnerAddress = partnerAddress

        this.chainFlipSdk = new SwapSDK({
            network: 'mainnet',
            enabledFeatures: { dca: true },
        })
    }

    protected async doPostTransitAction() {
        await checkMinAmount(this.symbiosis.cache, this.chainFlipSdk, this.transit.amountOutMin)

        const { src, dest } = this.config
        let quote: RegularQuote | undefined
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
            quote = quotes.find((quote) => quote.type === 'REGULAR')
        } catch (e) {
            throw new ChainFlipError('getQuoteV2', e)
        }

        if (!quote) {
            throw new ChainFlipError('There is no REGULAR quote found')
        }

        this.chainFlipQuote = quote

        try {
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
            throw new ChainFlipError('encodeVaultSwapData', e)
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
            throw new ChainFlipError('Same transit token. Prefer on-chain swap')
        }
        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = this.symbiosis.config.fallbackReceiver
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
            partnerAddress: this.partnerAddress,
        })

        const { egressAmount, recommendedSlippageTolerancePercent } = this.chainFlipQuote
        const egressAmountMin = getMinAmount(recommendedSlippageTolerancePercent * 100, egressAmount)

        const { usdcFeeToken, solFeeToken, btcFeeToken } = getChainFlipFee(this.chainFlipQuote)
        const amountOut = new TokenAmount(config.tokenOut, egressAmount)
        const amountOutMin = new TokenAmount(config.tokenOut, egressAmountMin)

        return {
            ...result,
            tokenAmountOut: amountOut,
            tokenAmountOutMin: amountOutMin,
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

    protected tradeCTo(): EvmAddress {
        return this.multicallRouter.address as EvmAddress
    }

    protected finalReceiveSide(): EvmAddress {
        return this.multicallRouter.address as EvmAddress
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
            throw new ChainFlipError(`Incorrect source chain: ${chain}`)
        }
        const { tokenIn } = this.config
        const { calldata, to } = this.chainFlipVaultSwapResponse
        callDatas.push(calldata)
        receiveSides.push(to)
        path.push(tokenIn.address)
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

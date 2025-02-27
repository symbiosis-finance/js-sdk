import { QuoteResponse, SwapSDK } from '@chainflip/sdk/swap'
import { BigNumber } from 'ethers'

import { TokenAmount } from '../../../entities'
import { BaseSwapping } from '../../swapping'
import { ChainFlipVault__factory, MulticallRouter } from '../../contracts'
import { OneInchProtocols } from '../../trade/oneInchTrade'
import { Error, ErrorCode } from '../../error'
import { OmniPoolConfig, SwapExactInParams, SwapExactInResult } from '../../types'
import { isEvmChainId } from '../../chainUtils'

import { getChainFlipFee, getDestinationAddress } from './utils'
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
    protected receiverAddress!: string
    protected chainFlipSdk: SwapSDK
    protected quoteResponse!: QuoteResponse
    protected config!: ChainFlipConfig
    protected evmTo!: string
    protected dstAddress: string

    public constructor(context: SwapExactInParams, omniPoolConfig: OmniPoolConfig) {
        const { symbiosis, to, tokenOut } = context
        super(symbiosis, omniPoolConfig)

        this.dstAddress = getDestinationAddress(to, tokenOut.chainId)

        this.chainFlipSdk = new SwapSDK({
            network: 'mainnet',
        })
    }

    protected async doPostTransitAction() {
        const { src, dest } = this.config
        try {
            this.quoteResponse = await this.chainFlipSdk.getQuote({
                amount: this.transit.amountOut.raw.toString(),
                srcChain: src.chain,
                srcAsset: src.asset,
                destChain: dest.chain,
                destAsset: dest.asset,
            })
        } catch (e) {
            console.error(e)
            throw new Error('The min swap amount is $10', ErrorCode.MIN_CHAINFLIP_AMOUNT_IN)
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

        const { egressAmount, includedFees } = this.quoteResponse.quote
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

        const { dest, tokenIn, vaultAddress } = this.config

        const chainFlipData = ChainFlipVault__factory.createInterface().encodeFunctionData('xSwapToken', [
            dest.chainId, // dstChain
            this.dstAddress, // dstAddress
            dest.assetId, // dstToken
            tokenIn.address, // srcToken (Arbitrum.USDC address)
            BigNumber.from(0), // amount (will be patched)
            [], //cfParameters
        ])

        callDatas.push(chainFlipData)
        receiveSides.push(vaultAddress)
        path.push(tokenIn.address) // Arbitrum.USDC address
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

import type { Token } from '../../../entities'
import { TokenAmount } from '../../../entities'
import { isEvmChainId } from '../../chainUtils'
import type { MulticallRouter } from '../../contracts'
import { ThorRouter__factory } from '../../contracts'
import { SlippageTooLowError, ThorChainError } from '../../sdkError'
import { TradeProvider } from '../../trade'
import { withTracing } from '../../tracing'
import type { Address, SwapExactInParams, SwapExactInResult } from '../../types'
import { BaseSwapping } from '../swapping'

import type { ThorChainDestination } from './types'
import type { ThorQuoteSwapResponse } from './utils'
import { fromThorAmount, getThorQuote, getThorVault } from './utils'

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected destinationAddress!: string

    protected thorTokenIn!: Token
    protected destination!: ThorChainDestination
    protected thorVault!: string
    protected thorQuote!: ThorQuoteSwapResponse
    protected evmTo!: Address
    protected thorSlippage!: number

    protected async doPostTransitAction() {
        this.thorQuote = await getThorQuote({
            thorTokenIn: this.thorTokenIn,
            thorTokenOut: this.destination.thorAsset,
            evmTo: this.evmTo,
            bitcoinAddress: this.destinationAddress,
            amount: this.transit.amountOut,
            slippage: this.thorSlippage,
        })
    }

    @withTracing({
        onCall: function (context, thorTokenIn, destination) {
            return {
                tokenAmountIn: context.tokenAmountIn.toString(),
                tokenOut: context.tokenOut.toString(),
                from: context.from,
                to: context.to,
                slippage: context.slippage,
                deadline: context.deadline,
                thorTokenIn: thorTokenIn.toString(),
                destination: `${destination.token.symbol}->${destination.thorAsset}`,
                partnerAddress: context.partnerAddress,
                fallbackReceiver: context.fallbackReceiver,
            }
        },
    })
    public async exactIn(
        context: SwapExactInParams,
        thorTokenIn: Token,
        destination: ThorChainDestination
    ): Promise<SwapExactInResult> {
        const {
            tokenAmountIn,
            from,
            to,
            slippage,
            deadline,
            partnerAddress,
            fallbackReceiver,
            disabledProviders,
            oneInchProtocols,
            signature,
            limits,
        } = context

        this.destinationAddress = to
        this.thorTokenIn = thorTokenIn
        this.destination = destination

        const minSlippage = 20 // 0.2%
        if (slippage < minSlippage) {
            throw new SlippageTooLowError('Slippage cannot be less than 0.2% for cross-chain ThorChain swap')
        }
        const minCrossChainSlippage = 10 // 0.1%
        const crossChainSlippage = Math.max(Math.floor(slippage / 2), minCrossChainSlippage)
        this.thorSlippage = slippage - crossChainSlippage

        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = fallbackReceiver ?? this.symbiosis.config.fallbackReceiver
        }

        this.multicallRouter = this.symbiosis.multicallRouter(thorTokenIn.chainId)
        this.thorVault = await getThorVault(this.symbiosis.cache, thorTokenIn)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(thorTokenIn.chainId, this.omniPoolConfig)
        if (transitTokenIn.equals(transitTokenOut)) {
            throw new ThorChainError('Same transit token. Prefer on-chain swap')
        }

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: thorTokenIn,
            from,
            to: this.evmTo,
            slippage: crossChainSlippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
            partnerAddress,
            depositoryEnabled: false,
            disabledProviders,
            oneInchProtocols,
            signature,
            limits,
        })

        return {
            ...result,
            tokenAmountOut: new TokenAmount(
                destination.token,
                fromThorAmount(this.thorQuote.expected_amount_out, destination.token.decimals)
            ),
            tokenAmountOutMin: new TokenAmount(
                destination.token,
                fromThorAmount(this.thorQuote.amount_out_min, destination.token.decimals)
            ),
            labels: [...result.labels, 'partner-swap' as const],
            routes: [
                ...result.routes,
                {
                    provider: TradeProvider.THORCHAIN_BRIDGE,
                    tokens: [thorTokenIn, destination.token],
                },
            ],
            fees: [
                ...result.fees,
                {
                    provider: TradeProvider.THORCHAIN_BRIDGE,
                    description: 'THORChain fee',
                    value: new TokenAmount(
                        destination.token,
                        fromThorAmount(this.thorQuote.fees.total, destination.token.decimals)
                    ),
                },
            ],
        }
    }

    protected tradeCTo(): Address {
        return this.multicallRouter.address as Address
    }

    protected finalReceiveSide(): Address {
        return this.multicallRouter.address as Address
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

        const expiry = Math.floor(Date.now() / 1000) + 60 * 60 // + 1h
        const burnCalldata = ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
            this.thorVault,
            this.thorTokenIn.address,
            '0', // will be patched
            this.thorQuote.memo,
            expiry,
        ])

        callDatas.push(burnCalldata)
        receiveSides.push(this.thorQuote.router)
        path.push(this.thorTokenIn.address)
        offsets.push(100)

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

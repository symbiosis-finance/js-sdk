import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { ChainFlipVault__factory, MulticallRouter } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { Error } from '../error'
import { OmniPoolConfig, SwapExactInResult } from '../types'
import { Symbiosis } from '../symbiosis'
import { SwapSDK } from '@chainflip/sdk/swap'
import { ChainId } from '../../constants'
import { getAddressEncoder, isAddress, Address } from '@solana/addresses'
import { BigNumber } from 'ethers'

export interface ZappingChainFlipExactInParams {
    tokenAmountIn: TokenAmount
    chainFlipTokenIn: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export class ZappingChainFlip extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected solanaAddress!: string
    protected chainFlipSdk: SwapSDK
    protected amountOut!: TokenAmount

    public constructor(symbiosis: Symbiosis, omniPoolConfig: OmniPoolConfig) {
        super(symbiosis, omniPoolConfig)

        this.chainFlipSdk = new SwapSDK({
            network: 'mainnet',
        })
    }

    protected async doPostTransitAction() {
        // TODO check chainFlipTokenIn here
        const quoteResponse = await this.chainFlipSdk.getQuote({
            amount: this.transit.amountIn.raw.toString(),
            srcChain: 'Arbitrum',
            srcAsset: 'USDC',
            destChain: 'Solana',
            destAsset: 'SOL',
        })

        console.log({ quote: quoteResponse })

        this.amountOut = new TokenAmount(GAS_TOKEN[ChainId.SOLANA_MAINNET], quoteResponse.quote['egressAmount'])
    }

    public async exactIn({
        tokenAmountIn,
        chainFlipTokenIn,
        from,
        to,
        slippage,
        deadline,
    }: ZappingChainFlipExactInParams): Promise<SwapExactInResult> {
        if (!isAddress(to)) {
            throw new Error('Solana address is not valid')
        }
        this.solanaAddress = to

        this.multicallRouter = this.symbiosis.multicallRouter(chainFlipTokenIn.chainId)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(chainFlipTokenIn.chainId, this.omniPoolConfig)

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: chainFlipTokenIn,
            from,
            to: from,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
        })

        return {
            ...result,
            tokenAmountOut: this.amountOut,
            tokenAmountOutMin: this.amountOut,
            routes: [
                ...result.routes,
                {
                    provider: 'chainflip-bridge',
                    tokens: [chainFlipTokenIn, this.amountOut.token],
                },
            ],
            fees: [
                ...result.fees,
                // {
                //     provider: 'chainflip-bridge',
                //     description: 'ChainFlip fee',
                //     value: new TokenAmount(BTC, this.quote.fees.total),
                // },
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

        const encoder = getAddressEncoder()
        const bytes = encoder.encode(this.solanaAddress as Address)
        const chainFlipData = ChainFlipVault__factory.createInterface().encodeFunctionData('xSwapToken', [
            5, // dstChain
            bytes, // dstAddress
            9, // dstToken (SOL)
            '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // srcToken (USDC Arbi)
            BigNumber.from(0), // amount (will be patched)
            [], //cfParameters
        ])

        callDatas.push(chainFlipData)
        receiveSides.push('0x79001a5e762f3befc8e5871b42f6734e00498920')
        path.push('0xaf88d065e77c8cC2239327C5EDb3A432268e5831') // USDC Arbi
        offsets.push(164)

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

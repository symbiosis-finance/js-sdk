import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { ChainFlipVault__factory, MulticallRouter } from '../contracts'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { Error } from '../error'
import { OmniPoolConfig, SwapExactInResult } from '../types'
import { Symbiosis } from '../symbiosis'
import { Asset, Chain, QuoteResponse, SwapSDK } from '@chainflip/sdk/swap'
import { ChainId } from '../../constants'
import { Address, getAddressEncoder, isAddress } from '@solana/addresses'
import { BigNumber } from 'ethers'
import { isEvmChainId } from '../chainUtils'

export interface ZappingChainFlipExactInParams {
    tokenAmountIn: TokenAmount
    config: ChainFlipConfig
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export enum ChainFlipChainId {
    Ethereum = 1,
    Polkadot = 2,
    Bitcoin = 3,
    Arbitrum = 4,
    Solana = 5,
}

export enum ChainFlipAssetId {
    ETH = 1,
    FLIP = 2,
    USDC = 3,
    DOT = 4,
    BTC = 5,
    arbETH = 6,
    arbUSDC = 7,
    USDT = 8,
    SOL = 9,
    solUSDC = 10,
}

export interface ChainFlipToken {
    chainId: ChainFlipChainId
    assetId: ChainFlipAssetId
    chain: Chain
    asset: Asset
}

export interface ChainFlipConfig {
    vaultAddress: string
    tokenIn: Token
    src: ChainFlipToken
    dest: ChainFlipToken
}

export class ZappingChainFlip extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected solanaAddress!: string
    protected chainFlipSdk: SwapSDK
    protected quoteResponse!: QuoteResponse
    protected config!: ChainFlipConfig
    protected evmTo!: string

    public constructor(symbiosis: Symbiosis, omniPoolConfig: OmniPoolConfig) {
        super(symbiosis, omniPoolConfig)

        this.chainFlipSdk = new SwapSDK({
            network: 'mainnet',
        })
    }

    protected async doPostTransitAction() {
        const { src, dest } = this.config
        this.quoteResponse = await this.chainFlipSdk.getQuote({
            amount: this.transit.amountOut.raw.toString(),
            srcChain: src.chain,
            srcAsset: src.asset,
            destChain: dest.chain,
            destAsset: dest.asset,
        })
    }

    public async exactIn({
        tokenAmountIn,
        config,
        from,
        to,
        slippage,
        deadline,
    }: ZappingChainFlipExactInParams): Promise<SwapExactInResult> {
        if (!isAddress(to)) {
            throw new Error('Solana address is not valid')
        }

        const chainFlipTokenIn = config.tokenIn
        this.config = config
        this.solanaAddress = to
        this.multicallRouter = this.symbiosis.multicallRouter(chainFlipTokenIn.chainId)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(chainFlipTokenIn.chainId, this.omniPoolConfig)

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
        const SOL = GAS_TOKEN[ChainId.SOLANA_MAINNET]

        const { egressAmount, includedFees } = this.quoteResponse.quote

        const amountOut = new TokenAmount(SOL, egressAmount)

        let usdcFee = 0
        let solFee = 0
        includedFees.forEach(({ asset, amount }) => {
            if (asset === 'USDC') {
                usdcFee += parseInt(amount)
            }
            if (asset === 'SOL') {
                solFee += parseInt(amount)
            }
        })

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
                    value: new TokenAmount(chainFlipTokenIn, usdcFee.toString()),
                },
                {
                    provider: 'chainflip-bridge',
                    description: 'ChainFlip fee',
                    value: new TokenAmount(SOL, solFee.toString()),
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

        const encoder = getAddressEncoder()
        const dstAddress = encoder.encode(this.solanaAddress as Address)
        const chainFlipData = ChainFlipVault__factory.createInterface().encodeFunctionData('xSwapToken', [
            dest.chainId, // dstChain
            dstAddress, // dstAddress
            dest.assetId, // dstToken (SOL)
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

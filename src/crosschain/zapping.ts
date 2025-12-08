import { MaxUint256 } from '@ethersproject/constants'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import type { TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import JSBI from 'jsbi'

import type { Token } from '../entities'
import { Percent, TokenAmount, wrappedToken } from '../entities'
import type { TronTransactionData } from './chainUtils'
import {
    buildMetaSynthesize,
    getExternalId,
    getInternalId,
    isTonChainId,
    isTronChainId,
    isTronToken,
    prepareTronTransaction,
    tronAddressToEvm,
} from './chainUtils'
import { BIPS_BASE, CROSS_CHAIN_ID } from './constants'
import type { MulticallRouter, OmniPool, OmniPoolOracle } from './contracts'
import { OmniLiquidity } from './omniLiquidity'
import { AmountLessThanFeeError, NoRepresentationFoundError, SdkError } from './sdkError'
import type { Symbiosis } from './symbiosis'
import { AggregatorTrade, WrapTrade } from './trade'
import { TRON_METAROUTER_ABI } from './tronAbis'
import type {
    OmniPoolConfig,
    RouteItem,
    SwapExactInResult,
    SwapExactInTransactionPayload,
    TonTransactionData,
} from './types'

type ZappingExactInParams = {
    tokenAmountIn: TokenAmount
    from: string
    to: string
    slippage: number
    deadline: number
}

export class Zapping {
    protected multicallRouter: MulticallRouter

    private from!: string
    private to!: string
    private revertableAddress!: string
    private tokenAmountIn!: TokenAmount
    private slippage!: number
    private deadline!: number

    private tradeA: AggregatorTrade | WrapTrade | undefined

    private synthToken!: Token
    private transitTokenIn!: Token

    private omniLiquidity!: OmniLiquidity
    private readonly pool!: OmniPool
    private readonly poolOracle!: OmniPoolOracle

    public constructor(private readonly symbiosis: Symbiosis, private readonly omniPoolConfig: OmniPoolConfig) {
        this.pool = this.symbiosis.omniPool(omniPoolConfig)
        this.poolOracle = this.symbiosis.omniPoolOracle(omniPoolConfig)

        this.multicallRouter = this.symbiosis.multicallRouter(omniPoolConfig.chainId)
    }

    public async exactIn({
        tokenAmountIn,
        from,
        to,
        slippage,
        deadline,
    }: ZappingExactInParams): Promise<SwapExactInResult> {
        this.tokenAmountIn = tokenAmountIn
        this.from = tronAddressToEvm(from)
        this.to = tronAddressToEvm(to)

        this.slippage = slippage
        this.deadline = deadline

        if (isTronToken(this.tokenAmountIn.token)) {
            this.revertableAddress = this.symbiosis.getRevertableAddress(this.omniPoolConfig.chainId)
        } else if (isTonChainId(this.tokenAmountIn.token.chainId)) {
            this.revertableAddress = this.symbiosis.getRevertableAddress(this.omniPoolConfig.chainId)
        } else {
            this.revertableAddress = this.from
        }

        const targetPool = this.symbiosis.getOmniPoolByConfig(this.omniPoolConfig)
        if (!targetPool) {
            throw new SdkError(`Unknown pool ${this.omniPoolConfig.address}`)
        }
        const wrapped = wrappedToken(tokenAmountIn.token)
        const tokenPool = this.symbiosis.getOmniPoolByToken(wrapped)
        if (tokenPool?.id === targetPool.id) {
            this.transitTokenIn = wrapped
        } else {
            this.transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        }

        if (!this.transitTokenIn.equals(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
        }

        this.synthToken = await this.getSynthToken()

        this.omniLiquidity = this.buildOmniLiquidity()
        await this.omniLiquidity.init()

        const fee = await this.getFee()

        this.omniLiquidity = this.buildOmniLiquidity(fee)
        await this.omniLiquidity.init()

        let payload: SwapExactInTransactionPayload
        if (isTronChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = this.getTronTransactionRequest(fee)
            payload = {
                transactionType: 'tron',
                transactionRequest,
            }
        } else if (isTonChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = await this.getTonTransactionRequest(fee)
            payload = {
                transactionType: 'ton',
                transactionRequest,
            }
        } else {
            const transactionRequest = this.getEvmTransactionRequest(fee)
            payload = {
                transactionType: 'evm',
                transactionRequest,
            }
        }

        const routes: RouteItem[] = []
        if (this.tradeA) {
            routes.push({
                provider: this.tradeA.tradeType,
                tokens: [this.tradeA.tokenAmountIn.token, this.tradeA.amountOut.token],
            })
        }
        routes.push({
            provider: 'symbiosis',
            tokens: [this.getPortalTokenAmountIn().token, this.omniLiquidity.tokenAmountIn.token],
        })

        return {
            ...payload,
            fees: [
                {
                    provider: 'symbiosis',
                    value: fee,
                },
            ],
            routes,
            kind: 'crosschain-swap',
            approveTo: this.symbiosis.chainConfig(tokenAmountIn.token.chainId).metaRouterGateway,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.getSynthAmount(fee),
            tokenAmountOut: this.omniLiquidity.amountOut,
            tokenAmountOutMin: this.omniLiquidity.amountOut,
        }
    }

    private async getTonTransactionRequest(fee: TokenAmount): Promise<TonTransactionData> {
        return buildMetaSynthesize({
            symbiosis: this.symbiosis,
            fee,
            validUntil: this.deadline,
            from: this.from,
            to: this.to,
            revertableAddress: this.revertableAddress,
            amountIn: this.tokenAmountIn,
            chainIdOut: this.omniPoolConfig.chainId,
            secondDexRouter: this.multicallRouter.address,
            secondSwapCallData: this.getMulticallData(),
            swapTokens: [this.synthToken.address, this.synthToken.address],
            finalCallData: '',
            finalReceiveSide: AddressZero,
            finalOffset: 0,
        })
    }

    private getEvmTransactionRequest(fee: TokenAmount): TransactionRequest {
        const [relayRecipient, otherSideCalldata] = this.otherSideSynthCallData(fee)

        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            // AddressZero if first token is GasToken
            firstToken = AddressZero
        }

        const approvedTokens = [firstToken, this.getPortalTokenAmountIn().token.address]

        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const params = {
            firstSwapCalldata: this.tradeA?.callData || [],
            secondSwapCalldata: [],
            approvedTokens,
            firstDexRouter: this.tradeA?.routerAddress || AddressZero,
            secondDexRouter: AddressZero,
            amount: this.tokenAmountIn.raw.toString(),
            nativeIn: this.tokenAmountIn.token.isNative,
            relayRecipient,
            otherSideCalldata,
        }

        const { chainId } = this.tokenAmountIn.token
        const metaRouter = this.symbiosis.metaRouter(chainId)
        const data = metaRouter.interface.encodeFunctionData('metaRoute', [params])

        return {
            chainId,
            to: metaRouter.address,
            data,
            value,
        }
    }

    private getTronTransactionRequest(fee: TokenAmount): TronTransactionData {
        const [relayRecipient, otherSideCalldata] = this.otherSideSynthCallData(fee)

        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            // AddressZero if first token is GasToken
            firstToken = AddressZero
        }

        const approvedTokens = [firstToken, this.getPortalTokenAmountIn().token.address]

        const { chainId } = this.tokenAmountIn.token
        const metaRouter = this.symbiosis.metaRouter(chainId)

        return prepareTronTransaction({
            chainId,
            tronWeb: this.symbiosis.tronWeb(chainId),
            abi: TRON_METAROUTER_ABI,
            contractAddress: metaRouter.address,
            functionName: 'metaRoute',
            params: [
                [
                    this.tradeA?.callData || [],
                    [],
                    approvedTokens,
                    this.tradeA?.routerAddress || AddressZero,
                    AddressZero,
                    this.tokenAmountIn.raw.toString(),
                    this.tokenAmountIn.token.isNative,
                    relayRecipient,
                    otherSideCalldata,
                ],
            ],
            ownerAddress: this.from,
            value: 0,
        })
    }

    private calculatePriceImpact(): Percent {
        const zero = new Percent(JSBI.BigInt(0), BIPS_BASE) // 0%
        let pi = this.tradeA?.priceImpact || zero

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    private getPortalTokenAmountIn(): TokenAmount {
        return this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn
    }

    private getSynthAmount(fee?: TokenAmount): TokenAmount {
        let synthAmount = new TokenAmount(this.synthToken, this.getPortalTokenAmountIn().raw)

        if (fee) {
            if (synthAmount.lessThan(fee) || synthAmount.equalTo(fee)) {
                throw new AmountLessThanFeeError(
                    `Amount ${synthAmount.toSignificant()} ${
                        synthAmount.token.symbol
                    } less than fee ${fee.toSignificant()} ${fee.token.symbol}`
                )
            }

            synthAmount = synthAmount.subtract(fee)
        }

        return synthAmount
    }

    private buildTradeA(): AggregatorTrade | WrapTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.transitTokenIn
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (WrapTrade.isSupported(this.tokenAmountIn.token, tokenOut)) {
            return new WrapTrade({
                tokenAmountIn: this.tokenAmountIn,
                tokenAmountInMin: this.tokenAmountIn, // correct as it is tradeA
                tokenOut,
                to: this.to,
            })
        }

        return new AggregatorTrade({
            tokenAmountIn: this.tokenAmountIn,
            tokenAmountInMin: this.tokenAmountIn,
            tokenOut,
            from,
            to,
            slippage: this.slippage / 100,
            symbiosis: this.symbiosis,
            clientId: this.symbiosis.clientId,
            deadline: this.deadline,
        })
    }

    private buildOmniLiquidity(fee?: TokenAmount): OmniLiquidity {
        const tokenAmountIn = this.getSynthAmount(fee)

        return new OmniLiquidity(tokenAmountIn, this.to, this.slippage, this.deadline, this.pool, this.poolOracle)
    }

    private getMulticallData(): string {
        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            '0', // amount will be patched
            [this.omniLiquidity.callData], // _calldata
            [this.pool.address], // _receiveSides
            [this.synthToken.address], // _path
            [this.omniLiquidity.callDataOffset], // _offset
            this.to, // _to
        ])
    }

    private otherSideSynthCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn) {
            throw new SdkError('Token is not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.omniPoolConfig.chainId
        const tokenAmount = this.getPortalTokenAmountIn()

        const portal = this.symbiosis.portal(chainIdIn)

        return [
            portal.address,
            portal.interface.encodeFunctionData('metaSynthesize', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: tokenAmount.raw.toString(),
                    rtoken: tokenAmount.token.address,
                    chain2address: this.to,
                    receiveSide: this.symbiosis.synthesis(chainIdOut).address,
                    oppositeBridge: this.symbiosis.bridge(chainIdOut).address,
                    syntCaller: this.from,
                    chainID: chainIdOut,
                    swapTokens: [this.synthToken.address, this.synthToken.address],
                    secondDexRouter: this.multicallRouter.address,
                    secondSwapCalldata: this.getMulticallData(),
                    finalReceiveSide: AddressZero,
                    finalCalldata: [],
                    finalOffset: 0,
                    revertableAddress: this.revertableAddress,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    private async getSynthToken(): Promise<Token> {
        const chainIdOut = this.omniPoolConfig.chainId
        const rep = this.symbiosis.getRepresentation(this.transitTokenIn, chainIdOut)

        if (!rep) {
            throw new NoRepresentationFoundError(
                `Representation of ${this.transitTokenIn.symbol} in chain ${chainIdOut} not found`
            )
        }

        return rep
    }

    protected async getFee(): Promise<TokenAmount> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.omniPoolConfig.chainId

        const portal = this.symbiosis.portal(chainIdIn)
        const synthesis = this.symbiosis.synthesis(chainIdOut)

        const amount = this.getPortalTokenAmountIn()

        const internalId = getInternalId({
            contractAddress: portal.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesis.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const calldata = synthesis.interface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: '1',
                amount: amount.raw.toString(),
                crossChainID: CROSS_CHAIN_ID,
                externalID: externalId,
                tokenReal: amount.token.address,
                chainID: chainIdIn,
                to: this.to,
                swapTokens: [this.synthToken.address, this.synthToken.address],
                secondDexRouter: this.multicallRouter.address,
                secondSwapCalldata: this.getMulticallData(),
                finalReceiveSide: AddressZero,
                finalCalldata: [],
                finalOffset: 0,
            },
        ])

        const { price: fee } = await this.symbiosis.getBridgeFee({
            receiveSide: synthesis.address,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: chainIdOut,
        })

        return new TokenAmount(this.synthToken, fee)
    }
}

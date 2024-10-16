import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { BIPS_BASE, CROSS_CHAIN_ID } from './constants'
import { Error, ErrorCode } from './error'
import type { Symbiosis } from './symbiosis'
import { AggregatorTrade } from './trade'
import {
    getExternalId,
    getInternalId,
    isTronChainId,
    isTronToken,
    prepareTronTransaction,
    tronAddressToEvm,
} from './chainUtils'
import { MulticallRouter, OmniPool, OmniPoolOracle } from './contracts'
import { DataProvider } from './dataProvider'
import { OmniLiquidity } from './omniLiquidity'
import { TRON_METAROUTER_ABI } from './tronAbis'
import { OmniPoolConfig, RouteItem, SwapExactInResult, SwapExactInTransactionPayload } from './types'
import { WrapTrade } from './trade'
import { WaitForComplete } from './waitForComplete'
import { isTonChainId } from './chainUtils'
import { buildMetaSynthesize } from './swapExactIn/fromTonSwap'

type ZappingExactInParams = {
    tokenAmountIn: TokenAmount
    from: string
    to: string
    slippage: number
    deadline: number
}

export class Zapping {
    protected dataProvider: DataProvider
    protected multicallRouter: MulticallRouter

    private from!: string
    private to!: string
    private revertableAddress!: string
    private tokenAmountIn!: TokenAmount
    private slippage!: number
    private deadline!: number
    private ttl!: number

    private tradeA: AggregatorTrade | WrapTrade | undefined

    private synthToken!: Token
    private transitTokenIn!: Token

    private omniLiquidity!: OmniLiquidity
    private readonly pool!: OmniPool
    private readonly poolOracle!: OmniPoolOracle

    public constructor(private readonly symbiosis: Symbiosis, private readonly omniPoolConfig: OmniPoolConfig) {
        this.dataProvider = new DataProvider(symbiosis)

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
        this.ttl = deadline - Math.floor(Date.now() / 1000)

        if (isTronToken(this.tokenAmountIn.token)) {
            this.revertableAddress = this.symbiosis.getRevertableAddress(this.omniPoolConfig.chainId)
        } else {
            this.revertableAddress = this.from
        }

        const targetPool = this.symbiosis.getOmniPoolByConfig(this.omniPoolConfig)
        if (!targetPool) {
            throw new Error(`Unknown pool ${this.omniPoolConfig.address}`)
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

        const payload = this.getTransactionRequest(fee)

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

    async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        return new WaitForComplete({
            direction: 'mint',
            chainIdOut: this.omniLiquidity.amountOut.token.chainId,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }

    private getTransactionRequest(fee: TokenAmount): SwapExactInTransactionPayload {
        const chainId = this.tokenAmountIn.token.chainId
        const metaRouter = this.symbiosis.metaRouter(chainId)

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

        if (isTonChainId(chainId)) {
            const transactionRequest = buildMetaSynthesize({
                symbiosis: this.symbiosis,
                fee,
                validUntil: this.deadline,
                from: this.from,
                amountIn: this.tokenAmountIn,
                poolChainId: this.omniPoolConfig.chainId,
                evmAddress: this.to,
                swapTokens: [],
                secondSwapCallData: '',
                secondDexRouter: AddressZero,
                finalCallData: otherSideCalldata,
                finalReceiveSide: relayRecipient,
                finalOffset: 100,
            })
            return {
                transactionRequest,
                transactionType: 'ton',
            }
        }

        if (isTronChainId(chainId)) {
            const transactionRequest = prepareTronTransaction({
                chainId: chainId,
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
            return {
                transactionRequest,
                transactionType: 'tron',
            }
        }

        const data = metaRouter.interface.encodeFunctionData('metaRoute', [params])

        const transactionRequest: TransactionRequest = {
            chainId,
            to: metaRouter.address,
            data,
            value,
        }
        return {
            transactionRequest,
            transactionType: 'evm',
        }
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
            synthAmount = synthAmount.subtract(fee)
        }

        return synthAmount
    }

    private buildTradeA(): AggregatorTrade | WrapTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.transitTokenIn
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (WrapTrade.isSupported(this.tokenAmountIn, tokenOut)) {
            return new WrapTrade(this.tokenAmountIn, tokenOut, this.to)
        }

        return new AggregatorTrade({
            tokenAmountIn: this.tokenAmountIn,
            tokenOut,
            from,
            to,
            slippage: this.slippage / 100,
            dataProvider: this.dataProvider,
            symbiosis: this.symbiosis,
            clientId: this.symbiosis.clientId,
            ttl: this.ttl,
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
            throw new Error('Token is not set')
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
            throw new Error(
                `Representation of ${this.transitTokenIn.symbol} in chain ${chainIdOut} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }

        return rep
    }

    protected async getFee(): Promise<TokenAmount> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.omniPoolConfig.chainId

        if (isTonChainId(chainIdIn)) {
            return new TokenAmount(this.synthToken, '0')
        }

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

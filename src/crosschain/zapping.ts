import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Signer, BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, TokenAmount } from '../entities'
import { Execute, WaitForMined } from './bridging'
import { BIPS_BASE } from './constants'
import { Error, ErrorCode } from './error'
import type { Symbiosis } from './symbiosis'
import { UniLikeTrade, AggregatorTrade, SymbiosisTradeType } from './trade'
import { calculateGasMargin, getExternalId, getInternalId } from './utils'
import { WaitForComplete } from './waitForComplete'
import { AdaRouter, AvaxRouter, OmniPool, OmniPoolOracle, UniLikeRouter } from './contracts'
import { DataProvider } from './dataProvider'
import { OmniLiquidity } from './omniLiquidity'

export type SwapExactIn = Promise<{
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    priceImpact: Percent
    amountInUsd: TokenAmount
    transactionRequest: TransactionRequest
    inTradeType?: SymbiosisTradeType
}>

export class Zapping {
    protected dataProvider: DataProvider

    private from!: string
    private to!: string
    private revertableAddress!: string
    private tokenAmountIn!: TokenAmount
    private slippage!: number
    private deadline!: number
    private ttl!: number
    private useAggregators!: boolean

    private tradeA: UniLikeTrade | AggregatorTrade | undefined

    private synthToken!: Token

    private omniLiquidity!: OmniLiquidity
    private readonly pool!: OmniPool
    private readonly poolOracle!: OmniPoolOracle
    private readonly symbiosis: Symbiosis

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
        this.dataProvider = new DataProvider(symbiosis)

        this.pool = this.symbiosis.omniPool()
        this.poolOracle = this.symbiosis.omniPoolOracle()
    }

    public async exactIn(
        tokenAmountIn: TokenAmount,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        useAggregators = true
    ): SwapExactIn {
        this.useAggregators = useAggregators
        this.tokenAmountIn = tokenAmountIn
        this.from = from
        this.to = to
        this.revertableAddress = revertableAddress
        this.slippage = slippage
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)

        let amountInUsd: TokenAmount

        if (!this.symbiosis.isTransitStable(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()

            amountInUsd = this.tradeA.amountOut
        } else {
            amountInUsd = tokenAmountIn
        }

        this.symbiosis.validateSwapAmounts(amountInUsd)

        this.synthToken = await this.getSynthToken()

        this.omniLiquidity = this.buildOmniLiquidity()
        await this.omniLiquidity.init()

        const fee = await this.getFee()

        this.omniLiquidity = this.buildOmniLiquidity(fee)
        await this.omniLiquidity.init()

        const transactionRequest = this.getTransactionRequest(fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee,
            tokenAmountOut: this.omniLiquidity.amountOut,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.getSynthAmount(fee),
            transactionRequest,
            inTradeType: this.tradeA?.tradeType,
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

    private getTransactionRequest(fee: TokenAmount): TransactionRequest {
        const chainId = this.tokenAmountIn.token.chainId
        const metaRouter = this.symbiosis.metaRouter(chainId)

        const [relayRecipient, otherSideCalldata] = this.otherSideSynthCallData(fee)

        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            // AddressZero if first token is GasToken
            firstToken = AddressZero
        }

        const approvedTokens = [
            firstToken,
            this.tradeA ? this.tradeA.amountOut.token.address : this.tokenAmountIn.token.address,
        ]

        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const data = metaRouter.interface.encodeFunctionData('metaRoute', [
            {
                firstSwapCalldata: this.tradeA?.callData || [],
                secondSwapCalldata: [],
                approvedTokens,
                firstDexRouter: this.tradeA?.routerAddress || AddressZero,
                secondDexRouter: AddressZero,
                amount: this.tokenAmountIn.raw.toString(),
                nativeIn: this.tokenAmountIn.token.isNative,
                relayRecipient,
                otherSideCalldata,
            },
        ])

        return {
            chainId,
            to: metaRouter.address,
            data,
            value,
        }
    }

    private calculatePriceImpact(): Percent {
        const zero = new Percent(JSBI.BigInt(0), BIPS_BASE) // 0%
        let pi = this.tradeA?.priceImpact || zero

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    private getSynthAmount(fee?: TokenAmount): TokenAmount {
        let synthAmount = new TokenAmount(
            this.synthToken,
            this.tradeA ? this.tradeA.amountOut.raw : this.tokenAmountIn.raw
        )

        if (fee) {
            synthAmount = synthAmount.subtract(fee)
        }

        return synthAmount
    }

    private buildTradeA(): UniLikeTrade | AggregatorTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.symbiosis.transitStable(chainId)
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (this.useAggregators && AggregatorTrade.isAvailable(chainId)) {
            return new AggregatorTrade({
                tokenAmountIn: this.tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage: this.slippage / 100,
                dataProvider: this.dataProvider,
                symbiosis: this.symbiosis,
                clientId: this.symbiosis.clientId,
            })
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerA: UniLikeRouter | AvaxRouter | AdaRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerA = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerA = this.symbiosis.adaRouter(chainId)
        }

        return new UniLikeTrade(this.tokenAmountIn, tokenOut, to, this.slippage, this.ttl, routerA, dexFee)
    }

    private buildOmniLiquidity(fee?: TokenAmount): OmniLiquidity {
        const tokenAmountIn = this.getSynthAmount(fee)

        return new OmniLiquidity(tokenAmountIn, this.to, this.slippage, this.deadline, this.pool, this.poolOracle)
    }

    private otherSideSynthCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn) {
            throw new Error('Token is not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.symbiosis.omniPoolConfig.chainId
        const tokenAmount = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn

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
                    swapTokens: [this.synthToken.address],
                    secondDexRouter: AddressZero,
                    secondSwapCalldata: [],
                    finalReceiveSide: this.pool.address,
                    finalCalldata: this.omniLiquidity.callData,
                    finalOffset: this.omniLiquidity.callDataOffset,
                    revertableAddress: this.revertableAddress,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected async execute(transactionRequest: TransactionRequest, signer: Signer): Execute {
        const transactionRequestWithGasLimit = { ...transactionRequest }

        const gasLimit = await signer.estimateGas(transactionRequest)

        transactionRequestWithGasLimit.gasLimit = calculateGasMargin(gasLimit)

        const response = await signer.sendTransaction(transactionRequestWithGasLimit)

        return {
            response,
            waitForMined: (confirmations = 1) => this.waitForMined(confirmations, response),
        }
    }

    protected async waitForMined(confirmations: number, response: TransactionResponse): WaitForMined {
        const receipt = await response.wait(confirmations)

        return {
            receipt,
            waitForComplete: () => this.waitForComplete(receipt),
        }
    }

    private async getSynthToken(): Promise<Token> {
        const chainIdOut = this.symbiosis.omniPoolConfig.chainId
        const transitStableIn = this.symbiosis.transitStable(this.tokenAmountIn.token.chainId)
        const rep = await this.symbiosis.getRepresentation(transitStableIn, chainIdOut)

        if (!rep) {
            throw new Error(
                `Representation of ${transitStableIn.symbol} in chain ${chainIdOut} not found`,
                ErrorCode.NO_ROUTE
            )
        }

        return rep
    }

    protected async getFee(): Promise<TokenAmount> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.symbiosis.omniPoolConfig.chainId

        const portal = this.symbiosis.portal(chainIdIn)
        const synthesis = this.symbiosis.synthesis(chainIdOut)

        const amount = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn

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
                externalID: externalId,
                tokenReal: amount.token.address,
                chainID: chainIdIn,
                to: this.to,
                swapTokens: [this.synthToken.address],
                secondDexRouter: AddressZero,
                secondSwapCalldata: [],
                finalReceiveSide: this.pool.address,
                finalCalldata: this.omniLiquidity.callData,
                finalOffset: this.omniLiquidity.callDataOffset,
            },
        ])

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide: synthesis.address,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: chainIdOut,
        })

        return new TokenAmount(this.synthToken, fee.toString())
    }
}

import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { BigNumber, Signer } from 'ethers'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { Execute, WaitForMined } from './bridging'
import { BIPS_BASE } from './constants'
import {
    AdaRouter,
    AvaxRouter,
    KavaRouter,
    Portal__factory,
    Synthesis,
    Synthesis__factory,
    UniLikeRouter,
} from './contracts'
import { DataProvider } from './dataProvider'
import type { Symbiosis } from './symbiosis'
import { AggregatorTrade, OneInchTrade, SymbiosisTradeType, UniLikeTrade } from './trade'
import { Transit } from './transit'
import { getExternalId, getInternalId, prepareTransactionRequest } from './utils'
import { WaitForComplete } from './waitForComplete'
import { Error, ErrorCode } from './error'
import { SymbiosisTrade } from './trade/symbiosisTrade'
import { OneInchProtocols } from './trade/oneInchTrade'
import { TronTransactionData, isTronToken, prepareTronTransaction, tronAddressToEvm } from './tron'
import { TRON_METAROUTER_ABI } from './tronAbis'

interface SwapInfo {
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    tokenAmountOutWithZeroFee: TokenAmount
    route: Token[]
    priceImpact: Percent
    amountInUsd: TokenAmount
    approveTo: string
    inTradeType?: SymbiosisTradeType
    outTradeType?: SymbiosisTradeType
}

export type EthSwapExactIn = SwapInfo & {
    type: 'evm'
    execute: (signer: Signer) => Execute
    transactionRequest: TransactionRequest
}

export type TronSwapExactIn = SwapInfo & {
    type: 'tron'
    transactionRequest: TronTransactionData
}

export type SwapExactIn = TronSwapExactIn | EthSwapExactIn

export type DetailedSlippage = {
    A: number
    B: number
    C: number
}

export type SwapOptions = {
    oneInchProtocols?: OneInchProtocols
}

export abstract class BaseSwapping {
    public amountInUsd: TokenAmount | undefined

    protected from!: string
    protected to!: string
    protected revertableAddress!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: DetailedSlippage
    protected deadline!: number
    protected ttl!: number
    protected useAggregators!: boolean

    protected route!: Token[]

    protected tradeA: SymbiosisTrade | undefined
    protected transit!: Transit
    protected tradeC: SymbiosisTrade | undefined

    protected dataProvider: DataProvider

    protected readonly symbiosis: Symbiosis
    protected synthesisV2!: Synthesis

    protected transitStableIn!: Token
    protected transitStableOut!: Token

    protected options!: SwapOptions

    protected feeV2: TokenAmount | undefined

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
        this.dataProvider = new DataProvider(symbiosis)
    }

    protected async doExactIn(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        useAggregators: boolean,
        options?: SwapOptions
    ): Promise<SwapExactIn> {
        this.options = options || {}
        this.useAggregators = useAggregators
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.transitStableIn = await this.symbiosis.bestTransitStable(this.tokenAmountIn.token.chainId)
        this.transitStableOut = await this.symbiosis.bestTransitStable(this.tokenOut.chainId)
        this.from = tronAddressToEvm(from)
        this.to = tronAddressToEvm(to)
        this.revertableAddress = tronAddressToEvm(revertableAddress)
        this.slippage = this.buildDetailedSlippage(slippage)
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)
        this.synthesisV2 = this.symbiosis.synthesis(this.symbiosis.omniPoolConfig.chainId)

        if (!this.transitStableIn.equals(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
        }

        this.transit = this.buildTransit()
        await this.transit.init()

        this.amountInUsd = this.transit.getBridgeAmountIn()

        if (!this.transitStableOut.equals(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
        }

        this.route = this.getRoute()

        const fee = await this.getFee(this.transit.feeToken)
        const feeV2 = this.transit.isV2() ? await this.getFeeV2() : undefined

        this.feeV2 = feeV2

        const tokenAmountOutWithZeroFee = this.tokenAmountOut()

        // >>> NOTE create trades with calculated fee
        this.transit = this.buildTransit(fee)
        await this.transit.init()

        if (!this.transitStableOut.equals(tokenOut)) {
            this.tradeC = this.buildTradeC(feeV2)
            await this.tradeC.init()
        }
        // <<< NOTE create trades with calculated fee

        const swapInfo: SwapInfo = {
            fee: feeV2 || fee,
            tokenAmountOut: this.tokenAmountOut(feeV2),
            tokenAmountOutWithZeroFee, // uses for calculation pure swap price except fee
            route: this.route,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.amountInUsd,
            approveTo: this.approveTo(),
            inTradeType: this.tradeA?.tradeType,
            outTradeType: this.tradeC?.tradeType,
        }

        if (isTronToken(this.tokenAmountIn.token)) {
            const transactionRequest = this.getTronTransactionRequest(fee, feeV2)

            return {
                ...swapInfo,
                type: 'tron',
                transactionRequest,
            }
        }

        const transactionRequest = this.getEvmTransactionRequest(fee, feeV2)

        return {
            ...swapInfo,
            type: 'evm',
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            transactionRequest,
        }
    }

    protected buildDetailedSlippage(totalSlippage: number): DetailedSlippage {
        let externalSwapsCount = 0
        if (!this.transitStableIn.equals(this.tokenAmountIn.token)) {
            externalSwapsCount += 1
        }
        if (!this.transitStableOut.equals(this.tokenOut)) {
            externalSwapsCount += 1
        }

        if (externalSwapsCount === 0) {
            return {
                A: 0,
                B: totalSlippage,
                C: 0,
            }
        }

        const stableSwapSlippage = 50 // 0.5%
        if (totalSlippage < 150) {
            // 1.5%
            throw new Error('Slippage cannot be less than 1.5%')
        }
        const externalSwapSlippage = (totalSlippage - stableSwapSlippage) / externalSwapsCount

        return {
            A: externalSwapSlippage,
            B: stableSwapSlippage,
            C: externalSwapSlippage,
        }
    }

    protected approveTo(): string {
        return this.symbiosis.chainConfig(this.tokenAmountIn.token.chainId).metaRouterGateway
    }

    protected async execute(transactionRequest: TransactionRequest, signer: Signer): Execute {
        console.warn('Execute method is deprecated. Use transactionRequest object instead. Check readme for details.')

        const preparedTransactionRequest = await prepareTransactionRequest(transactionRequest, signer)

        const response = await signer.sendTransaction(preparedTransactionRequest)

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

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }
        if (this.transit.isV2()) {
            const wfc1 = new WaitForComplete({
                direction: 'mint',
                symbiosis: this.symbiosis,
                revertableAddress: this.revertableAddress,
                chainIdIn: this.tokenAmountIn.token.chainId,
                chainIdOut: this.symbiosis.omniPoolConfig.chainId,
            })
            const log = await wfc1.waitForComplete(receipt)

            const provider = this.symbiosis.getProvider(this.symbiosis.omniPoolConfig.chainId)
            const receipt2 = await provider.getTransactionReceipt(log.transactionHash)

            const wfc2 = new WaitForComplete({
                direction: 'burn',
                symbiosis: this.symbiosis,
                revertableAddress: this.revertableAddress,
                chainIdIn: this.symbiosis.omniPoolConfig.chainId,
                chainIdOut: this.tokenOut.chainId,
            })
            return wfc2.waitForComplete(receipt2)
        }
        return new WaitForComplete({
            direction: this.transit.direction,
            chainIdOut: this.tokenOut.chainId,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }

    protected getEvmTransactionRequest(fee: TokenAmount, feeV2: TokenAmount | undefined): TransactionRequest {
        const chainId = this.tokenAmountIn.token.chainId
        const metaRouter = this.symbiosis.metaRouter(chainId)

        const [relayRecipient, otherSideCalldata] = this.otherSideData(fee, feeV2)

        const amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const data = metaRouter.interface.encodeFunctionData('metaRoute', [
            {
                amount: amount.raw.toString(),
                nativeIn: amount.token.isNative,
                approvedTokens: this.approvedTokens().map(tronAddressToEvm),
                firstDexRouter: tronAddressToEvm(this.firstDexRouter()),
                firstSwapCalldata: this.firstSwapCalldata(),
                secondDexRouter: tronAddressToEvm(this.secondDexRouter()),
                secondSwapCalldata: this.transit.direction === 'burn' ? this.secondSwapCalldata() : [],
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

    protected getTronTransactionRequest(fee: TokenAmount, feeV2: TokenAmount | undefined): TronTransactionData {
        const { chainId } = this.tokenAmountIn.token
        const { metaRouter } = this.symbiosis.chainConfig(chainId)

        const [relayRecipient, otherSideCalldata] = this.otherSideData(fee, feeV2)

        const amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const tronWeb = this.symbiosis.tronWeb(chainId)

        return prepareTronTransaction({
            chainId,
            tronWeb,
            abi: TRON_METAROUTER_ABI,
            contractAddress: metaRouter,
            functionName: 'metaRoute',
            params: [
                [
                    this.firstSwapCalldata(),
                    this.transit.direction === 'burn' ? this.secondSwapCalldata() : [],
                    this.approvedTokens().map(tronAddressToEvm),
                    tronAddressToEvm(this.firstDexRouter()),
                    this.secondDexRouter(),
                    amount.raw.toString(),
                    amount.token.isNative,
                    tronAddressToEvm(relayRecipient),
                    otherSideCalldata,
                ],
            ],
            ownerAddress: this.from,
            value: value?.toString() ?? 0,
        })
    }

    protected calculatePriceImpact(): Percent {
        const zero = new Percent(JSBI.BigInt(0), BIPS_BASE) // 0%
        const pia = this.tradeA?.priceImpact || zero
        const pib = this.transit.priceImpact || zero
        const pic = this.tradeC?.priceImpact || zero

        // console.log([pia, pib, pic].map((i) => i.toSignificant()))

        let pi = pia.add(pib).add(pic)

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    protected tokenAmountOut(feeV2?: TokenAmount | undefined): TokenAmount {
        if (this.tradeC) {
            return this.tradeC.amountOut
        }
        if (this.transit.isV2()) {
            let amount = this.transit.amountOut.raw
            if (feeV2) {
                amount = JSBI.subtract(amount, feeV2.raw)
            }
            return new TokenAmount(this.tokenOut, amount)
        }

        return this.transit.amountOut
    }

    protected buildTradeA(): SymbiosisTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.transitStableIn
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from
        const dexFee = this.symbiosis.dexFee(chainId)

        if (this.useAggregators && AggregatorTrade.isAvailable(chainId)) {
            return new AggregatorTrade({
                tokenAmountIn: this.tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage: this.slippage['A'] / 100,
                symbiosis: this.symbiosis,
                dataProvider: this.dataProvider,
                clientId: this.symbiosis.clientId,
                options: this.options,
            })
        }

        let routerA: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter = this.symbiosis.uniLikeRouter(chainId)

        if (chainId === ChainId.AVAX_MAINNET) {
            routerA = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerA = this.symbiosis.adaRouter(chainId)
        }
        if ([ChainId.KAVA_MAINNET].includes(chainId)) {
            routerA = this.symbiosis.kavaRouter(chainId)
        }

        return new UniLikeTrade(this.tokenAmountIn, tokenOut, to, this.slippage['A'], this.ttl, routerA, dexFee)
    }

    protected buildTransit(fee?: TokenAmount): Transit {
        return new Transit(
            this.symbiosis,
            this.dataProvider,
            this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn,
            this.tokenOut,
            this.transitStableIn,
            this.transitStableOut,
            this.slippage['B'],
            this.deadline,
            fee
        )
    }

    protected tradeCTo() {
        return this.to
    }

    protected buildTradeC(feeV2?: TokenAmount) {
        let amountIn = this.transit.amountOut

        if (this.transit.isV2()) {
            let amountRaw = amountIn.raw
            if (feeV2) {
                if (amountIn.lessThan(feeV2)) {
                    throw new Error(
                        `Amount ${amountIn.toSignificant()} ${
                            amountIn.token.symbol
                        } less than fee ${feeV2.toSignificant()} ${feeV2.token.symbol}`,
                        ErrorCode.AMOUNT_LESS_THAN_FEE
                    )
                }
                amountRaw = JSBI.subtract(amountRaw, feeV2.raw)
            }
            amountIn = new TokenAmount(this.transitStableOut, amountRaw)
        }

        const chainId = this.tokenOut.chainId
        const dexFee = this.symbiosis.dexFee(chainId)

        // POLYGON_ZK only
        if (chainId === ChainId.POLYGON_ZK && this.useAggregators && AggregatorTrade.isAvailable(chainId)) {
            const from = this.symbiosis.metaRouter(chainId).address
            return new AggregatorTrade({
                tokenAmountIn: amountIn,
                tokenOut: this.tokenOut,
                from,
                to: this.tradeCTo(),
                slippage: this.slippage['C'] / 100,
                symbiosis: this.symbiosis,
                dataProvider: this.dataProvider,
                clientId: this.symbiosis.clientId,
                options: this.options,
            })
        }

        if (this.useAggregators && OneInchTrade.isAvailable(chainId)) {
            const from = this.symbiosis.metaRouter(chainId).address
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(
                amountIn,
                this.tokenOut,
                from,
                this.tradeCTo(),
                this.slippage['C'] / 100,
                oracle,
                this.dataProvider,
                this.options.oneInchProtocols
            )
        }

        let routerC: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter = this.symbiosis.uniLikeRouter(chainId)

        if (chainId === ChainId.AVAX_MAINNET) {
            routerC = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerC = this.symbiosis.adaRouter(chainId)
        }
        if ([ChainId.KAVA_MAINNET].includes(chainId)) {
            routerC = this.symbiosis.kavaRouter(chainId)
        }

        return new UniLikeTrade(amountIn, this.tokenOut, this.tradeCTo(), this.slippage['C'], this.ttl, routerC, dexFee)
    }

    protected getRoute(): Token[] {
        const started = this.tradeA ? [] : [this.tokenAmountIn.token]
        const terminated = this.tradeC ? [] : [this.tokenOut]

        return [
            ...started,
            ...(this.tradeA ? this.tradeA.route : []),
            ...this.transit.route,
            ...(this.tradeC ? this.tradeC.route : []),
            ...terminated,
        ].reduce((acc: Token[], token: Token) => {
            const found = acc.find((i) => i.equals(token))
            if (found) return acc
            return [...acc, token]
        }, [])
    }

    protected metaBurnSyntheticToken(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        const amount = this.transit.getBridgeAmountIn()

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: amount.raw.toString(),
                    syntCaller: tronAddressToEvm(this.from),
                    finalReceiveSide: tronAddressToEvm(this.finalReceiveSide()),
                    sToken: tronAddressToEvm(amount.token.address),
                    finalCallData: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    chain2address: tronAddressToEvm(this.to),
                    receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                    oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                    revertableAddress: tronAddressToEvm(this.revertableAddress),
                    chainID: this.tokenOut.chainId,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected metaSynthesize(fee: TokenAmount, feeV2: TokenAmount | undefined): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.transit.isV2() ? this.symbiosis.omniPoolConfig.chainId : this.tokenOut.chainId
        const tokenAmount = this.transit.getBridgeAmountIn()

        const portal = this.symbiosis.portal(chainIdIn)

        return [
            portal.address,
            portal.interface.encodeFunctionData('metaSynthesize', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: tokenAmount.raw.toString(),
                    rtoken: tronAddressToEvm(tokenAmount.token.address),
                    chain2address: this.to,
                    receiveSide: tronAddressToEvm(this.symbiosis.synthesis(chainIdOut).address),
                    oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(chainIdOut).address),
                    syntCaller: tronAddressToEvm(this.from),
                    chainID: chainIdOut,
                    swapTokens: this.swapTokens().map(tronAddressToEvm),
                    secondDexRouter: tronAddressToEvm(this.secondDexRouter()),
                    secondSwapCalldata: this.secondSwapCalldata(),
                    finalReceiveSide: tronAddressToEvm(
                        this.transit.isV2() ? this.finalReceiveSideV2() : this.finalReceiveSide()
                    ),
                    finalCalldata: this.transit.isV2() ? this.finalCalldataV2(feeV2) : this.finalCalldata(),
                    finalOffset: this.transit.isV2() ? this.finalOffsetV2() : this.finalOffset(),
                    revertableAddress: tronAddressToEvm(this.revertableAddress),
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected otherSideData(fee: TokenAmount, feeV2: TokenAmount | undefined): [string, string] {
        return this.transit.direction === 'burn' ? this.metaBurnSyntheticToken(fee) : this.metaSynthesize(fee, feeV2) // mint or v2
    }

    protected async feeMintCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.transit.isV2() ? this.symbiosis.omniPoolConfig.chainId : this.tokenOut.chainId

        const portalAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdIn).portal)
        const synthesisAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdOut).synthesis)

        const internalId = getInternalId({
            contractAddress: portalAddress,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesisAddress,
            revertableAddress: tronAddressToEvm(this.revertableAddress),
            chainId: chainIdOut,
        })

        const amount = this.transit.getBridgeAmountIn()

        const synthesisInterface = Synthesis__factory.createInterface()

        const callData = synthesisInterface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: '0',
                amount: amount.raw.toString(),
                externalID: externalId,
                tokenReal: tronAddressToEvm(amount.token.address),
                chainID: chainIdIn,
                to: tronAddressToEvm(this.to),
                swapTokens: this.swapTokens().map(tronAddressToEvm),
                secondDexRouter: tronAddressToEvm(this.secondDexRouter()),
                secondSwapCalldata: this.secondSwapCalldata(),
                finalReceiveSide: tronAddressToEvm(
                    this.transit.isV2() ? this.finalReceiveSideV2() : this.finalReceiveSide()
                ),
                finalCalldata: this.transit.isV2() ? this.finalCalldataV2() : this.finalCalldata(),
                finalOffset: this.transit.isV2() ? this.finalOffsetV2() : this.finalOffset(),
            },
        ])

        return [synthesisAddress, callData]
    }

    protected async feeBurnCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesisAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdIn).synthesis)
        const portalAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdOut).portal)

        const internalId = getInternalId({
            contractAddress: synthesisAddress,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portalAddress,
            revertableAddress: tronAddressToEvm(this.revertableAddress),
            chainId: chainIdOut,
        })

        const amount = this.transit.amountOut

        const portalInterface = Portal__factory.createInterface()

        // TODO: Use contracts from tron if needed
        const calldata = portalInterface.encodeFunctionData('metaUnsynthesize', [
            '1', // _stableBridgingFee
            externalId, // _externalID,
            tronAddressToEvm(this.to), // _to
            amount.raw.toString(), // _amount
            tronAddressToEvm(amount.token.address), // _rToken
            tronAddressToEvm(this.finalReceiveSide()), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])

        return [portalAddress, calldata]
    }

    protected async feeBurnCallDataV2(): Promise<[string, string]> {
        const chainIdIn = this.symbiosis.omniPoolConfig.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesisAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdIn).synthesis)
        const portalAddress = tronAddressToEvm(this.symbiosis.chainConfig(chainIdOut).portal)

        const internalId = getInternalId({
            contractAddress: synthesisAddress,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portalAddress,
            revertableAddress: tronAddressToEvm(this.revertableAddress),
            chainId: chainIdOut,
        })

        const portalInterface = Portal__factory.createInterface()

        const calldata = portalInterface.encodeFunctionData('metaUnsynthesize', [
            '0', // _stableBridgingFee
            externalId, // _externalID,
            tronAddressToEvm(this.to), // _to
            this.transit.amountOut.raw.toString(), // _amount
            tronAddressToEvm(this.transitStableOut.address), // _rToken
            tronAddressToEvm(this.finalReceiveSide()), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])

        return [portalAddress, calldata]
    }

    protected async getFee(feeToken: Token): Promise<TokenAmount> {
        const chainIdFrom = this.tokenAmountIn.token.chainId
        const chainIdTo = this.transit.isV2() ? this.symbiosis.omniPoolConfig.chainId : this.tokenOut.chainId
        const [receiveSide, calldata] =
            this.transit.direction === 'burn' ? await this.feeBurnCallData() : await this.feeMintCallData() // mint or v2
        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom,
            chainIdTo,
        })

        return new TokenAmount(feeToken, fee.toString())
    }

    protected async getFeeV2(): Promise<TokenAmount> {
        const feeToken = this.transitStableOut
        const [receiveSide, calldata] = await this.feeBurnCallDataV2()

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.symbiosis.omniPoolConfig.chainId,
            chainIdTo: this.tokenOut.chainId,
        })
        return new TokenAmount(feeToken, fee.toString())
    }

    protected approvedTokens(): string[] {
        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            firstToken = AddressZero // AddressZero if first token is GasToken
        }

        let tokens: string[]
        if (this.transit.direction === 'burn') {
            tokens = [firstToken, ...this.transit.route.map((i) => i.address)]
        } else {
            tokens = [firstToken, this.tradeA ? this.tradeA.amountOut.token.address : this.tokenAmountIn.token.address]
        }
        return tokens
    }

    protected firstDexRouter(): string {
        return this.tradeA?.routerAddress || AddressZero
    }

    protected firstSwapCalldata(): string | [] {
        return this.tradeA?.callData || []
    }

    protected secondDexRouter(): string {
        return this.transit.receiveSide
    }

    protected secondSwapCalldata(): string | [] {
        return this.transit.callData
    }

    protected finalReceiveSide(): string {
        return this.tradeC?.routerAddress || AddressZero
    }

    protected finalReceiveSideV2(): string {
        return this.synthesisV2.address
    }

    protected finalCalldata(): string | [] {
        return this.tradeC?.callData || []
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        return this.synthesisV2.interface.encodeFunctionData('metaBurnSyntheticToken', [
            {
                stableBridgingFee: feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
                amount: this.transit.amountOut.raw.toString(), // uint256 amount;
                syntCaller: tronAddressToEvm(this.symbiosis.metaRouter(this.symbiosis.omniPoolConfig.chainId).address), // address syntCaller;
                finalReceiveSide: tronAddressToEvm(this.finalReceiveSide()), // address finalReceiveSide;
                sToken: tronAddressToEvm(this.transit.amountOut.token.address), // address sToken;
                finalCallData: this.finalCalldata(), // bytes finalCallData;
                finalOffset: this.finalOffset(), // uint256 finalOffset;
                chain2address: tronAddressToEvm(this.to), // address chain2address;
                receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                revertableAddress: tronAddressToEvm(this.revertableAddress),
                chainID: this.tokenOut.chainId,
                clientID: this.symbiosis.clientId,
            },
        ])
    }

    protected finalOffset(): number {
        return this.tradeC?.callDataOffset || 0
    }

    protected finalOffsetV2(): number {
        return 100
    }

    protected swapTokens(): string[] {
        if (this.transit.route.length === 0) {
            return []
        }

        const tokens = [this.transit.route[0].address, this.transit.route[this.transit.route.length - 1].address]

        if (this.transit.isV2()) {
            return tokens
        }

        if (this.tradeC) {
            tokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        } else {
            tokens.push(...this.extraSwapTokens())
        }
        return tokens
    }

    protected extraSwapTokens(): string[] {
        return []
    }
}

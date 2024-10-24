import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest } from '@ethersproject/providers'
import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { BIPS_BASE, CROSS_CHAIN_ID } from './constants'
import { Portal__factory, Synthesis, Synthesis__factory } from './contracts'
import { DataProvider } from './dataProvider'
import type { Symbiosis } from './symbiosis'
import { AggregatorTrade, WrapTrade } from './trade'
import { Transit } from './transit'
import { LegacyWaitForComplete } from './legacyWaitForComplete'
import { Error, ErrorCode } from './error'
import { SymbiosisTrade } from './trade/symbiosisTrade'
import { OneInchProtocols } from './trade/oneInchTrade'
import {
    splitSlippage,
    getExternalId,
    getInternalId,
    DetailedSlippage,
    TronTransactionData,
    isTronToken,
    prepareTronTransaction,
    tronAddressToEvm,
    isTronChainId,
    isTonChainId,
} from './chainUtils'
import { TRON_METAROUTER_ABI } from './tronAbis'
import {
    FeeItem,
    OmniPoolConfig,
    RouteItem,
    SwapExactInParams,
    SwapExactInResult,
    SwapExactInTransactionPayload,
    TonTransactionData,
} from './types'

export abstract class BaseSwapping {
    public amountInUsd: TokenAmount | undefined

    protected from!: string
    protected to!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: DetailedSlippage
    protected deadline!: number
    protected ttl!: number
    protected revertableAddresses!: { AB: string; BC: string }

    protected route!: Token[]

    protected tradeA: SymbiosisTrade | undefined
    protected transit!: Transit
    protected tradeC: SymbiosisTrade | undefined

    protected dataProvider: DataProvider

    protected readonly symbiosis: Symbiosis
    protected synthesisV2!: Synthesis

    protected transitTokenIn!: Token
    protected transitTokenOut!: Token

    protected omniPoolConfig: OmniPoolConfig
    protected oneInchProtocols?: OneInchProtocols

    protected feeV2: TokenAmount | undefined

    public constructor(symbiosis: Symbiosis, omniPoolConfig: OmniPoolConfig) {
        this.omniPoolConfig = omniPoolConfig
        this.symbiosis = symbiosis
        this.dataProvider = new DataProvider(symbiosis)
    }

    async doExactIn({
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
        oneInchProtocols,
        transitTokenIn,
        transitTokenOut,
    }: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        const start = Date.now()
        let prev = start
        const timeLog = []
        const routes: RouteItem[] = []

        this.oneInchProtocols = oneInchProtocols
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut

        this.transitTokenIn =
            transitTokenIn || this.symbiosis.transitToken(this.tokenAmountIn.token.chainId, this.omniPoolConfig)

        this.transitTokenOut =
            transitTokenOut || this.symbiosis.transitToken(this.tokenOut.chainId, this.omniPoolConfig)

        this.from = tronAddressToEvm(from)
        this.to = tronAddressToEvm(to)
        this.slippage = this.buildDetailedSlippage(slippage)
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)
        this.synthesisV2 = this.symbiosis.synthesis(this.omniPoolConfig.chainId)

        if (isTronToken(this.tokenAmountIn.token) || isTronToken(this.tokenOut)) {
            this.revertableAddresses = {
                AB: this.symbiosis.getRevertableAddress(this.tokenAmountIn.token.chainId),
                BC: this.symbiosis.getRevertableAddress(this.tokenOut.chainId),
            }
        } else if (isTonChainId(this.tokenAmountIn.token.chainId) || isTonChainId(this.tokenOut.chainId)) {
            this.revertableAddresses = {
                AB: this.symbiosis.getRevertableAddress(this.tokenAmountIn.token.chainId),
                BC: this.symbiosis.getRevertableAddress(this.tokenOut.chainId),
            }
        } else {
            this.revertableAddresses = { AB: this.from, BC: this.from }
        }

        if (!this.transitTokenIn.equals(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
            timeLog.push(['A', Date.now() - start])
            prev = Date.now()
            routes.push({
                provider: this.tradeA.tradeType,
                tokens: [this.tradeA.tokenAmountIn.token, this.tradeA.amountOut.token],
            })
        }

        this.transit = this.buildTransit()

        await this.transit.init()
        timeLog.push(['TRANSIT', Date.now() - start, Date.now() - prev])
        prev = Date.now()

        routes.push({
            provider: 'symbiosis',
            tokens: [this.transitTokenIn, this.transitTokenOut],
        })

        await this.doPostTransitAction()

        this.amountInUsd = this.transit.getBridgeAmountIn()

        if (!this.transitTokenOut.equals(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
            timeLog.push(['C1', Date.now() - start, Date.now() - prev])
            prev = Date.now()
            routes.push({
                provider: this.tradeC.tradeType,
                tokens: [this.tradeC.tokenAmountIn.token, this.tradeC.amountOut.token],
            })
        }

        this.route = this.getRoute()

        const [feeV1Raw, feeV2Raw] = await Promise.all([
            this.getFee(this.transit.feeToken),
            this.transit.isV2() ? this.getFeeV2() : undefined,
        ])

        timeLog.push(['ADVISOR', Date.now() - start, Date.now() - prev])
        prev = Date.now()

        const feeV2 = feeV2Raw?.fee
        this.feeV2 = feeV2

        // >>> NOTE create trades with calculated fee
        let fee = this.transit.fee!
        let save = new TokenAmount(this.transit.feeToken, '0')

        if (!this.transit.fee) {
            fee = feeV1Raw.fee
            save = feeV1Raw.save
            this.transit = this.buildTransit(fee)
            await this.transit.init()
        }

        await this.doPostTransitAction()
        if (!this.transitTokenOut.equals(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()

            timeLog.push(['C2', Date.now() - start, Date.now() - prev])
        }
        // <<< NOTE create trades with calculated fee

        const tokenAmountOut = this.tokenAmountOut(feeV2)
        const tokenAmountOutMin = new TokenAmount(
            tokenAmountOut.token,
            JSBI.divide(JSBI.multiply(this.transit.amountOutMin.raw, tokenAmountOut.raw), this.transit.amountOut.raw)
        )

        let payload: SwapExactInTransactionPayload
        if (isTronChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = this.getTronTransactionRequest(fee, feeV2)
            payload = {
                transactionType: 'tron',
                transactionRequest,
            }
        } else if (isTonChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = await this.getTonTransactionRequest(fee, feeV2)
            payload = {
                transactionType: 'ton',
                transactionRequest,
            }
        } else {
            const transactionRequest = this.getEvmTransactionRequest(fee, feeV2)
            payload = {
                transactionType: 'evm',
                transactionRequest,
            }
        }

        timeLog.push(['F', Date.now() - start])

        const fees: FeeItem[] = [
            {
                provider: 'symbiosis',
                value: fee,
                description: 'Cross-chain fee',
                save,
            },
        ]
        if (feeV2Raw) {
            fees.push({
                provider: 'symbiosis',
                value: feeV2Raw.fee,
                description: 'Cross-chain fee',
                save: feeV2Raw.save,
            })
        }

        return {
            ...payload,
            kind: 'crosschain-swap',
            tokenAmountOut,
            tokenAmountOutMin,
            priceImpact: this.calculatePriceImpact(),
            approveTo: this.approveTo(),
            routes,
            fees,
            amountInUsd: this.amountInUsd,
            timeLog,
        }
    }

    protected getRevertableAddress(side: 'AB' | 'BC'): string {
        return this.revertableAddresses[side]
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    protected async doPostTransitAction() {}

    protected buildDetailedSlippage(totalSlippage: number): DetailedSlippage {
        const hasTradeA = !this.transitTokenIn.equals(this.tokenAmountIn.token)
        const hasTradeC = !this.transitTokenOut.equals(this.tokenOut)

        return splitSlippage(totalSlippage, hasTradeA, hasTradeC)
    }

    protected approveTo(): string {
        return this.symbiosis.chainConfig(this.tokenAmountIn.token.chainId).metaRouterGateway
    }

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        if (this.transit.isV2()) {
            const wfc1 = new LegacyWaitForComplete({
                direction: 'mint',
                symbiosis: this.symbiosis,
                revertableAddress: this.getRevertableAddress('AB'),
                chainIdIn: this.tokenAmountIn.token.chainId,
                chainIdOut: this.omniPoolConfig.chainId,
            })
            const log = await wfc1.waitForComplete(receipt)

            const provider = this.symbiosis.getProvider(this.omniPoolConfig.chainId)
            const receipt2 = await provider.getTransactionReceipt(log.transactionHash)

            const wfc2 = new LegacyWaitForComplete({
                direction: 'burn',
                symbiosis: this.symbiosis,
                revertableAddress: this.getRevertableAddress('BC'),
                chainIdIn: this.omniPoolConfig.chainId,
                chainIdOut: this.tokenOut.chainId,
            })
            return wfc2.waitForComplete(receipt2)
        }

        return new LegacyWaitForComplete({
            direction: this.transit.direction,
            chainIdOut: this.tokenOut.chainId,
            symbiosis: this.symbiosis,
            revertableAddress: this.getRevertableAddress('AB'),
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

    protected async getTonTransactionRequest(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _fee: TokenAmount,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _feeV2: TokenAmount | undefined
    ): Promise<TonTransactionData> {
        throw new Error('getTonTransactionRequest not implemented')
    }

    protected calculatePriceImpact(): Percent {
        const zero = new Percent(JSBI.BigInt(0), BIPS_BASE) // 0%
        const pia = this.tradeA?.priceImpact || zero
        const pib = this.transit.priceImpact || zero
        const pic = this.tradeC?.priceImpact || zero

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
                if (JSBI.lessThan(amount, feeV2.raw) || JSBI.equal(amount, feeV2.raw)) {
                    throw new Error(
                        `Amount ${this.transit.amountOut.toSignificant()} ${
                            feeV2.token.symbol
                        } less than feeV2 ${feeV2.toSignificant()} ${feeV2.token.symbol}`,
                        ErrorCode.AMOUNT_LESS_THAN_FEE
                    )
                }
                amount = JSBI.subtract(amount, feeV2.raw)
            }
            return new TokenAmount(this.tokenOut, amount)
        }

        return this.transit.amountOut
    }

    protected buildTradeA(): SymbiosisTrade {
        const tokenOut = this.transitTokenIn

        if (WrapTrade.isSupported(this.tokenAmountIn, tokenOut)) {
            return new WrapTrade(this.tokenAmountIn, tokenOut, this.to)
        }

        const chainId = this.tokenAmountIn.token.chainId
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        return new AggregatorTrade({
            tokenAmountIn: this.tokenAmountIn,
            tokenOut,
            from,
            to,
            slippage: this.slippage['A'],
            symbiosis: this.symbiosis,
            dataProvider: this.dataProvider,
            clientId: this.symbiosis.clientId,
            ttl: this.ttl,
            oneInchProtocols: this.oneInchProtocols,
        })
    }

    protected buildTransit(fee?: TokenAmount): Transit {
        const amountIn = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn
        const amountInMin = this.tradeA ? this.tradeA.amountOutMin : amountIn

        this.symbiosis.validateLimits(amountIn)

        return new Transit(
            this.symbiosis,
            amountIn,
            amountInMin,
            this.tokenOut,
            this.transitTokenIn,
            this.transitTokenOut,
            this.slippage['B'],
            this.deadline,
            this.omniPoolConfig,
            fee
        )
    }

    protected tradeCTo() {
        return this.to
    }

    protected getTradeCAmountIn(): TokenAmount {
        let amountIn = this.transit.amountOut

        if (this.transit.isV2()) {
            let amountRaw = amountIn.raw
            if (this.feeV2) {
                if (amountIn.lessThan(this.feeV2) || amountIn.equalTo(this.feeV2)) {
                    throw new Error(
                        `Amount ${amountIn.toSignificant()} ${
                            amountIn.token.symbol
                        } less than feeV2 ${this.feeV2.toSignificant()} ${this.feeV2.token.symbol}`,
                        ErrorCode.AMOUNT_LESS_THAN_FEE
                    )
                }
                amountRaw = JSBI.subtract(amountRaw, this.feeV2.raw)
            }
            amountIn = new TokenAmount(this.transitTokenOut, amountRaw)
        }
        return amountIn
    }

    protected buildTradeC() {
        const amountIn = this.getTradeCAmountIn()

        const chainId = this.tokenOut.chainId

        if (WrapTrade.isSupported(amountIn, this.tokenOut)) {
            return new WrapTrade(amountIn, this.tokenOut, this.to)
        }

        const from = this.symbiosis.metaRouter(chainId).address
        return new AggregatorTrade({
            tokenAmountIn: amountIn,
            tokenOut: this.tokenOut,
            from,
            to: this.tradeCTo(),
            slippage: this.slippage['C'],
            symbiosis: this.symbiosis,
            dataProvider: this.dataProvider,
            clientId: this.symbiosis.clientId,
            ttl: this.ttl,
            oneInchProtocols: this.oneInchProtocols,
        })
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
                    crossChainID: CROSS_CHAIN_ID,
                    finalReceiveSide: tronAddressToEvm(this.finalReceiveSide()),
                    sToken: tronAddressToEvm(amount.token.address),
                    finalCallData: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    chain2address: tronAddressToEvm(this.to),
                    receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                    oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                    revertableAddress: this.getRevertableAddress('BC'),
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
        const chainIdOut = this.transit.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId
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
                    finalReceiveSide: tronAddressToEvm(this.transit.isV2() ? this.finalReceiveSideV2() : AddressZero),
                    finalCalldata: this.transit.isV2() ? this.finalCalldataV2(feeV2) : [],
                    finalOffset: this.transit.isV2() ? this.finalOffsetV2() : 0,
                    revertableAddress: this.getRevertableAddress('AB'),
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected otherSideData(fee: TokenAmount, feeV2: TokenAmount | undefined): [string, string] {
        return this.transit.direction === 'burn' ? this.metaBurnSyntheticToken(fee) : this.metaSynthesize(fee, feeV2) // mint or v2
    }

    protected feeMintCallData(): [string, string] {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.transit.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId

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
            revertableAddress: this.getRevertableAddress('AB'),
            chainId: chainIdOut,
        })

        const amount = this.transit.getBridgeAmountIn()

        const synthesisInterface = Synthesis__factory.createInterface()

        const callData = synthesisInterface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: '0',
                amount: amount.raw.toString(),
                crossChainID: CROSS_CHAIN_ID,
                externalID: externalId,
                tokenReal: tronAddressToEvm(amount.token.address),
                chainID: chainIdIn,
                to: tronAddressToEvm(this.to),
                swapTokens: this.swapTokens().map(tronAddressToEvm),
                secondDexRouter: tronAddressToEvm(this.secondDexRouter()),
                secondSwapCalldata: this.secondSwapCalldata(),
                finalReceiveSide: tronAddressToEvm(this.transit.isV2() ? this.finalReceiveSideV2() : AddressZero),
                finalCalldata: this.transit.isV2() ? this.finalCalldataV2() : [],
                finalOffset: this.transit.isV2() ? this.finalOffsetV2() : 0,
            },
        ])

        return [synthesisAddress, callData]
    }

    protected feeBurnCallData(): [string, string] {
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
            revertableAddress: this.getRevertableAddress('BC'),
            chainId: chainIdOut,
        })

        const amount = this.transit.amountOut

        const portalInterface = Portal__factory.createInterface()

        const calldata = portalInterface.encodeFunctionData('metaUnsynthesize', [
            '0', // _stableBridgingFee
            CROSS_CHAIN_ID, // crossChainID
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

    protected feeBurnCallDataV2(): [string, string] {
        const chainIdIn = this.omniPoolConfig.chainId
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
            revertableAddress: this.getRevertableAddress('BC'),
            chainId: chainIdOut,
        })

        const portalInterface = Portal__factory.createInterface()

        const calldata = portalInterface.encodeFunctionData('metaUnsynthesize', [
            '0', // _stableBridgingFee
            CROSS_CHAIN_ID, // crossChainID
            externalId, // _externalID,
            tronAddressToEvm(this.to), // _to
            this.transit.amountOut.raw.toString(), // _amount
            tronAddressToEvm(this.transitTokenOut.address), // _rToken
            tronAddressToEvm(this.finalReceiveSide()), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])

        return [portalAddress, calldata]
    }

    protected async getFee(feeToken: Token): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        const chainIdFrom = this.tokenAmountIn.token.chainId
        const chainIdTo = this.transit.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId
        const [receiveSide, calldata] =
            this.transit.direction === 'burn' ? this.feeBurnCallData() : this.feeMintCallData() // mint or v2
        const { price: fee, save } = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom,
            chainIdTo,
        })

        return {
            fee: new TokenAmount(feeToken, fee),
            save: new TokenAmount(feeToken, save),
        }
    }

    protected async getFeeV2(): Promise<{ fee: TokenAmount; save: TokenAmount }> {
        const feeToken = this.transitTokenOut
        const [receiveSide, calldata] = this.feeBurnCallDataV2()

        const { price: fee, save } = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.omniPoolConfig.chainId,
            chainIdTo: this.tokenOut.chainId,
        })
        return {
            fee: new TokenAmount(feeToken, fee),
            save: new TokenAmount(feeToken, save),
        }
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

    // 1) get multicall router address
    protected secondDexRouter(): string {
        const multicallRouter = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId)
        return multicallRouter.address
    }

    // 2) get second swap calldata, no edits (will be only [swap]). Put in field secondSwapCalldata() in ton request
    protected secondSwapCalldata(): string | [] {
        const calls = this.transit.calls()
        if (!calls) {
            return []
        }

        const { calldatas, receiveSides, paths, offsets } = calls

        if (this.transit.direction === 'mint' && this.tradeC) {
            calldatas.push(this.finalCalldata() as string)
            receiveSides.push(this.finalReceiveSide())
            paths.push(wrappedToken(this.tradeC.amountOut.token).address)
            offsets.push(this.finalOffset())
        }

        const multicallRouter = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId)
        return multicallRouter.interface.encodeFunctionData('multicall', [
            this.transit.amountIn.raw.toString(),
            calldatas, // calldata
            receiveSides, // receiveSides
            paths, // path
            offsets, // offset
            this.symbiosis.metaRouter(this.omniPoolConfig.chainId).address,
        ])
    }

    protected finalReceiveSide(): string {
        return this.tradeC?.routerAddress || AddressZero
    }

    protected finalReceiveSideV2(): string {
        return this.synthesisV2.address
    }

    // C
    protected finalCalldata(): string | [] {
        return this.tradeC?.callData || []
    }

    protected finalCalldataV2(feeV2?: TokenAmount | undefined): string {
        return this.synthesisV2.interface.encodeFunctionData('metaBurnSyntheticToken', [
            {
                stableBridgingFee: feeV2 ? feeV2?.raw.toString() : '0', // uint256 stableBridgingFee;
                amount: this.transit.amountOut.raw.toString(), // uint256 amount;
                syntCaller: tronAddressToEvm(this.symbiosis.metaRouter(this.omniPoolConfig.chainId).address), // address syntCaller;
                crossChainID: CROSS_CHAIN_ID,
                finalReceiveSide: tronAddressToEvm(this.finalReceiveSide()), // address finalReceiveSide;
                sToken: tronAddressToEvm(this.transit.amountOut.token.address), // address sToken;
                finalCallData: this.finalCalldata(), // bytes finalCallData;
                finalOffset: this.finalOffset(), // uint256 finalOffset;
                chain2address: tronAddressToEvm(this.to), // address chain2address;
                receiveSide: tronAddressToEvm(this.symbiosis.portal(this.tokenOut.chainId).address),
                oppositeBridge: tronAddressToEvm(this.symbiosis.bridge(this.tokenOut.chainId).address),
                revertableAddress: this.getRevertableAddress('BC'),
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

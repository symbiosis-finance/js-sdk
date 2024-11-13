import { AddressZero, MaxUint256 } from '@ethersproject/constants'
import { TransactionRequest } from '@ethersproject/providers'
import JSBI from 'jsbi'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { BIPS_BASE, CROSS_CHAIN_ID } from '../constants'
import { Portal__factory, Synthesis, Synthesis__factory } from '../contracts'
import { DataProvider } from '../dataProvider'
import type { Symbiosis } from '../symbiosis'
import { AggregatorTrade, WrapTrade } from '../trade'
import { Transit } from '../transit'
import { Error } from '../error'
import { SymbiosisTrade } from '../trade/symbiosisTrade'
import { OneInchProtocols } from '../trade/oneInchTrade'
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
    isEvmChainId,
} from '../chainUtils'
import { TRON_METAROUTER_ABI } from '../tronAbis'
import {
    FeeItem,
    OmniPoolConfig,
    RouteItem,
    SwapExactInParams,
    SwapExactInResult,
    SwapExactInTransactionPayload,
    TonTransactionData,
} from '../types'
import { Profiler } from '../../entities/profiler'

type MetaRouteParams = {
    amount: string
    nativeIn: boolean
    approvedTokens: string[]
    firstDexRouter: string
    firstSwapCalldata: string | []
    secondDexRouter: string
    secondSwapCalldata: string | []
    relayRecipient: string
    otherSideCalldata: string
}
export abstract class BaseSwapping {
    // TODO rename to `transitAmount`
    public amountInUsd: TokenAmount | undefined

    protected from!: string
    protected to!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: DetailedSlippage
    protected deadline!: number
    protected ttl!: number
    protected revertableAddresses!: { AB: string; BC: string }

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

    private profiler: Profiler

    public constructor(symbiosis: Symbiosis, omniPoolConfig: OmniPoolConfig) {
        this.omniPoolConfig = omniPoolConfig
        this.symbiosis = symbiosis
        this.dataProvider = new DataProvider(symbiosis)
        this.profiler = new Profiler()
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
            this.profiler.tick('A')
            routes.push({
                provider: this.tradeA.tradeType,
                tokens: [this.tradeA.tokenAmountIn.token, this.tradeA.amountOut.token],
            })
        }

        this.transit = this.buildTransit()
        await this.transit.init()
        this.profiler.tick('TRANSIT')
        routes.push({
            provider: 'symbiosis',
            tokens: [this.transitTokenIn, this.transitTokenOut],
        })

        await this.doPostTransitAction()
        this.profiler.tick('POST_TRANSIT_ACTION')

        this.amountInUsd = this.transit.getBridgeAmountIn()

        if (!this.transitTokenOut.equals(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
            this.profiler.tick('C_1')
            routes.push({
                provider: this.tradeC.tradeType,
                tokens: [this.tradeC.tokenAmountIn.token, this.tradeC.amountOut.token],
            })
        }

        const [fee1Raw, fee2Raw] = await Promise.all([
            this.getFee(this.transit.feeToken1),
            this.transit.feeToken2 ? this.getFeeV2(this.transit.feeToken2) : undefined,
        ])
        this.profiler.tick('ADVISOR')

        const fee1 = fee1Raw.fee
        const save1 = fee1Raw.save
        const fee2 = fee2Raw?.fee
        const save2 = fee2Raw?.save

        const patchingEnabled = true
        if (patchingEnabled) {
            this.transit.applyFees(fee1, fee2)
            if (this.tradeC) {
                this.tradeC.applyAmountIn(this.transit.amountOut)
            }
        } else {
            // this.transit = this.buildTransit(fee1, fee2)
            // await this.transit.init()
            // this.profiler.tick('TRANSIT_2')
            //
            // await this.doPostTransitAction()
            // this.profiler.tick('POST_TRANSIT_ACTION_2')
            //
            // this.amountInUsd = this.transit.getBridgeAmountIn()
            //
            // if (!this.transitTokenOut.equals(tokenOut)) {
            //     this.tradeC = this.buildTradeC()
            //     await this.tradeC.init()
            //     this.profiler.tick('C_2')
            // }
        }

        const tokenAmountOut = this.tokenAmountOut()
        const tokenAmountOutMin = new TokenAmount(
            tokenAmountOut.token,
            JSBI.divide(JSBI.multiply(this.transit.amountOutMin.raw, tokenAmountOut.raw), this.transit.amountOut.raw)
        )

        const metaRouteParams = this.getMetaRouteParams(fee1, fee2)

        let payload: SwapExactInTransactionPayload
        if (isEvmChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = this.getEvmTransactionRequest(metaRouteParams)
            payload = {
                transactionType: 'evm',
                transactionRequest,
            }
        } else if (isTronChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = this.getTronTransactionRequest(metaRouteParams)
            payload = {
                transactionType: 'tron',
                transactionRequest,
            }
        } else if (isTonChainId(this.tokenAmountIn.token.chainId)) {
            const transactionRequest = await this.getTonTransactionRequest(fee1, fee2)
            payload = {
                transactionType: 'ton',
                transactionRequest,
            }
        } else {
            throw new Error(`Unsupported chain type: ${this.tokenAmountIn.token.chainId}`)
        }

        this.profiler.tick('TRANSACTION_REQUEST')

        const fees: FeeItem[] = [
            {
                provider: 'symbiosis',
                value: fee1,
                description: 'Cross-chain fee',
                save: save1,
            },
        ]
        if (fee2) {
            fees.push({
                provider: 'symbiosis',
                value: fee2,
                description: 'Cross-chain fee',
                save: save2,
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
            timeLog: this.profiler.toString(),
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

    protected getValue() {
        return this.tokenAmountIn.token.isNative ? this.tokenAmountIn.raw.toString() : '0'
    }

    protected getMetaRouteParams(fee: TokenAmount, feeV2: TokenAmount | undefined): MetaRouteParams {
        const [relayRecipient, otherSideCalldata] = this.otherSideData(fee, feeV2)

        const amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
        return {
            amount: amount.raw.toString(),
            nativeIn: amount.token.isNative,
            approvedTokens: this.approvedTokens().map(tronAddressToEvm),
            firstDexRouter: tronAddressToEvm(this.firstDexRouter()),
            firstSwapCalldata: this.firstSwapCalldata(),
            secondDexRouter: tronAddressToEvm(this.secondDexRouter()),
            secondSwapCalldata: this.transit.direction === 'burn' ? this.secondSwapCalldata() : [],
            relayRecipient,
            otherSideCalldata,
        }
    }

    protected getEvmTransactionRequest(params: MetaRouteParams): TransactionRequest {
        const chainId = this.tokenAmountIn.token.chainId
        const metaRouter = this.symbiosis.metaRouter(chainId)
        const data = metaRouter.interface.encodeFunctionData('metaRoute', [params])

        return {
            chainId,
            to: metaRouter.address,
            data,
            value: this.getValue(),
        }
    }

    protected getTronTransactionRequest(params: MetaRouteParams): TronTransactionData {
        const { chainId } = this.tokenAmountIn.token
        const { metaRouter } = this.symbiosis.chainConfig(chainId)

        const tronWeb = this.symbiosis.tronWeb(chainId)

        return prepareTronTransaction({
            chainId,
            tronWeb,
            abi: TRON_METAROUTER_ABI,
            contractAddress: metaRouter,
            functionName: 'metaRoute',
            params: [
                [
                    params.firstSwapCalldata,
                    params.secondSwapCalldata,
                    params.approvedTokens,
                    params.firstDexRouter,
                    params.secondDexRouter,
                    params.amount,
                    params.nativeIn,
                    params.relayRecipient,
                    params.otherSideCalldata,
                ],
            ],
            ownerAddress: this.from,
            value: this.getValue(),
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
        const pib = this.transit.trade.priceImpact || zero
        const pic = this.tradeC?.priceImpact || zero

        let pi = pia.add(pib).add(pic)

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    protected tokenAmountOut(): TokenAmount {
        if (this.tradeC) {
            return this.tradeC.amountOut
        }

        return this.transit.amountOut
    }

    protected buildTradeA(): SymbiosisTrade {
        const tokenOut = this.transitTokenIn

        if (WrapTrade.isSupported(this.tokenAmountIn, tokenOut)) {
            return new WrapTrade(this.tokenAmountIn, tokenOut, this.to)
        }

        const chainId = this.tokenAmountIn.token.chainId
        const from = this.symbiosis.chainConfig(chainId).metaRouter
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

    protected buildTransit(fee1?: TokenAmount, fee2?: TokenAmount): Transit {
        const amountIn = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn
        const amountInMin = this.tradeA ? this.tradeA.amountOutMin : amountIn

        this.symbiosis.validateLimits(amountIn)

        return new Transit(
            this.symbiosis,
            amountIn,
            amountInMin,
            this.transitTokenOut,
            this.slippage['B'],
            this.deadline,
            this.omniPoolConfig,
            fee1,
            fee2
        )
    }

    protected tradeCTo() {
        return this.to
    }

    protected buildTradeC() {
        const amountIn = this.transit.amountOut

        if (WrapTrade.isSupported(amountIn, this.tokenOut)) {
            return new WrapTrade(amountIn, this.tokenOut, this.to)
        }

        return new AggregatorTrade({
            tokenAmountIn: amountIn,
            tokenOut: this.tokenOut,
            from: this.symbiosis.chainConfig(this.tokenOut.chainId).metaRouter,
            to: this.tradeCTo(),
            slippage: this.slippage['C'],
            symbiosis: this.symbiosis,
            dataProvider: this.dataProvider,
            clientId: this.symbiosis.clientId,
            ttl: this.ttl,
            oneInchProtocols: this.oneInchProtocols,
        })
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

    protected async getFeeV2(feeToken: Token): Promise<{ fee: TokenAmount; save: TokenAmount }> {
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
            tokens = [firstToken, ...this.transit.trade.route.map((i) => i.address)]
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
        const multicallRouter = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId)
        return multicallRouter.address
    }

    protected secondSwapCalldata(): string | [] {
        const calls = this.transit.calls()
        if (!calls) {
            return []
        }

        const { calldatas, receiveSides, paths, offsets } = calls

        // this flow when there is swap on host chain, for example, USDC -> BOBA
        if (this.transit.direction === 'mint' && this.tradeC) {
            calldatas.push(this.finalCalldata() as string)
            receiveSides.push(this.finalReceiveSide())
            paths.push(wrappedToken(this.tradeC.amountOut.token).address)
            offsets.push(this.finalOffset())
        }

        const multicallRouter = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId)
        return multicallRouter.interface.encodeFunctionData('multicall', [
            this.transit.amountIn.raw.toString(),
            calldatas,
            receiveSides,
            paths,
            offsets,
            this.symbiosis.metaRouter(this.omniPoolConfig.chainId).address,
        ])
    }

    protected finalReceiveSide(): string {
        return this.tradeC?.routerAddress || AddressZero
    }

    protected finalCalldata(): string | [] {
        return this.tradeC?.callData || []
    }

    protected finalOffset(): number {
        return this.tradeC?.callDataOffset || 0
    }

    protected finalReceiveSideV2(): string {
        return this.synthesisV2.address
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

    protected finalOffsetV2(): number {
        return 100
    }

    protected swapTokens(): string[] {
        if (this.transit.trade.route.length === 0) {
            return []
        }

        const tokens = [
            this.transit.trade.route[0].address,
            this.transit.trade.route[this.transit.trade.route.length - 1].address,
        ]

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

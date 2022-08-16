import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { MaxUint256 } from '@ethersproject/constants'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Signer, BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { Execute, WaitForMined } from './bridging'
import { BIPS_BASE, MANAGER_CHAIN } from './constants'
import type { Symbiosis } from './symbiosis'
import { UniLikeTrade } from './uniLikeTrade'
import { calculateGasMargin, canOneInch, getExternalId, getInternalId } from './utils'
import { WaitForComplete } from './waitForComplete'
import { AdaRouter, AvaxRouter, Synthesis, UniLikeRouter } from './contracts'
import { OneInchTrade } from './oneInchTrade'
import { DataProvider } from './dataProvider'
import { Transit } from './transit'

export type SwapExactIn = Promise<{
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    tokenAmountOutWithZeroFee: TokenAmount
    route: Token[]
    priceImpact: Percent
    amountInUsd: TokenAmount
    transactionRequest: TransactionRequest
    approveTo: string
}>

export abstract class BaseSwapping {
    public amountInUsd: TokenAmount | undefined

    protected from!: string
    protected to!: string
    protected revertableAddress!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: number
    protected deadline!: number
    protected ttl!: number
    protected use1Inch!: boolean

    protected route!: Token[]

    protected tradeA: UniLikeTrade | OneInchTrade | undefined
    protected transit!: Transit
    protected tradeC: UniLikeTrade | OneInchTrade | undefined

    protected dataProvider: DataProvider

    protected readonly symbiosis: Symbiosis
    protected synthesisV2!: Synthesis

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
        use1Inch: boolean
    ): SwapExactIn {
        this.use1Inch = use1Inch
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.revertableAddress = revertableAddress
        this.slippage = slippage
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)
        this.synthesisV2 = this.symbiosis.synthesis(MANAGER_CHAIN)

        if (!this.symbiosis.isTransitStable(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
        }

        this.transit = this.buildTransit()
        await this.transit.init()

        this.amountInUsd = this.transit.getBridgeAmountIn()

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
        }

        this.route = this.getRoute()

        const fee = await this.getFee(this.transit.feeToken)

        const tokenAmountOutWithZeroFee = this.tokenAmountOut()

        // >>> NOTE create trades with calculated fee
        this.transit = await this.buildTransit(fee)
        await this.transit.init()

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init()
        }
        // <<< NOTE create trades with calculated fee

        const transactionRequest = this.getTransactionRequest(fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee,
            tokenAmountOut: this.tokenAmountOut(),
            tokenAmountOutWithZeroFee, // uses for calculation pure swap price except fee
            route: this.route,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.amountInUsd,
            transactionRequest,
            approveTo: this.approveTo(),
        }
    }

    protected approveTo(): string {
        return this.symbiosis.chainConfig(this.tokenAmountIn.token.chainId).metaRouterGateway
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

    public async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        return new WaitForComplete({
            direction: this.transit.direction,
            tokenOut: this.tokenOut,
            symbiosis: this.symbiosis,
            revertableAddress: this.revertableAddress,
            chainIdIn: this.tokenAmountIn.token.chainId,
        }).waitForComplete(receipt)
    }

    protected getTransactionRequest(fee: TokenAmount): TransactionRequest {
        const chainId = this.tokenAmountIn.token.chainId
        const metaRouter = this.symbiosis.metaRouter(chainId)

        const [relayRecipient, otherSideCalldata] = this.otherSideData(fee)

        const amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const data = metaRouter.interface.encodeFunctionData('metaRoute', [
            {
                amount: amount.raw.toString(),
                nativeIn: amount.token.isNative,
                approvedTokens: this.approvedTokens(),
                firstDexRouter: this.firstDexRouter(),
                firstSwapCalldata: this.firstSwapCalldata(),
                secondDexRouter: this.secondDexRouter(),
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

    protected tokenAmountOut(): TokenAmount {
        if (this.tradeC) {
            return this.tradeC.amountOut
        }

        return this.transit.amountOut
    }

    protected buildTradeA(): UniLikeTrade | OneInchTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.symbiosis.transitStable(chainId)
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (this.use1Inch && canOneInch(chainId)) {
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(
                this.tokenAmountIn,
                tokenOut,
                from,
                to,
                this.slippage / 100,
                oracle,
                this.dataProvider
            )
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

    protected buildTransit(fee?: TokenAmount): Transit {
        return new Transit(
            this.symbiosis,
            this.dataProvider,
            this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn,
            this.tokenOut,
            this.slippage,
            this.deadline,
            fee
        )
    }

    protected buildTradeC() {
        const chainId = this.tokenOut.chainId
        let amountIn = this.transit.amountOut

        if (this.transit.isV2()) {
            const tokenOut = this.symbiosis.transitStable(chainId)
            amountIn = new TokenAmount(tokenOut, amountIn.raw)
        }

        if (this.use1Inch && canOneInch(chainId)) {
            const from = this.symbiosis.metaRouter(chainId).address
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(
                amountIn,
                this.tokenOut,
                from,
                this.to,
                this.slippage / 100,
                oracle,
                this.dataProvider
            )
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerC: UniLikeRouter | AvaxRouter | AdaRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerC = this.symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerC = this.symbiosis.adaRouter(chainId)
        }

        return new UniLikeTrade(amountIn, this.tokenOut, this.to, this.slippage, this.ttl, routerC, dexFee)
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
                    syntCaller: this.from,
                    finalReceiveSide: this.finalReceiveSide(),
                    sToken: amount.token.address,
                    finalCallData: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    chain2address: this.to,
                    receiveSide: this.symbiosis.portal(this.tokenOut.chainId).address,
                    oppositeBridge: this.symbiosis.bridge(this.tokenOut.chainId).address,
                    revertableAddress: this.revertableAddress,
                    chainID: this.tokenOut.chainId,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected metaSynthesize(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.transit.isV2() ? MANAGER_CHAIN : this.tokenOut.chainId
        const tokenAmount = this.transit.getBridgeAmountIn()

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
                    swapTokens: this.swapTokens(),
                    secondDexRouter: this.secondDexRouter(),
                    secondSwapCalldata: this.secondSwapCalldata(),
                    finalReceiveSide: this.finalReceiveSide(),
                    finalCalldata: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    revertableAddress: this.revertableAddress,
                    clientID: this.symbiosis.clientId,
                },
            ]),
        ]
    }

    protected otherSideData(fee: TokenAmount): [string, string] {
        return this.transit.direction === 'burn' ? this.metaBurnSyntheticToken(fee) : this.metaSynthesize(fee) // mint or v2
    }

    protected async feeMintCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.transit.isV2() ? MANAGER_CHAIN : this.tokenOut.chainId

        const portal = this.symbiosis.portal(chainIdIn)
        const synthesis = this.symbiosis.synthesis(chainIdOut)

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

        const amount = this.transit.getBridgeAmountIn()

        const callData = synthesis.interface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: '0',
                amount: amount.raw.toString(),
                externalID: externalId,
                tokenReal: amount.token.address,
                chainID: chainIdIn,
                to: this.to,
                swapTokens: this.swapTokens(),
                secondDexRouter: this.secondDexRouter(),
                secondSwapCalldata: this.secondSwapCalldata(),
                finalReceiveSide: this.finalReceiveSide(),
                finalCalldata: this.finalCalldata(),
                finalOffset: this.finalOffset(),
            },
        ])

        return [synthesis.address, callData]
    }

    protected async feeBurnCallData(): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesis = this.symbiosis.synthesis(chainIdIn)
        const portal = this.symbiosis.portal(chainIdOut)

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: MaxUint256,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portal.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const amount = this.transit.amountOut

        const calldata = portal.interface.encodeFunctionData('metaUnsynthesize', [
            '1', // _stableBridgingFee
            externalId, // _externalID,
            this.to, // _to
            amount.raw.toString(), // _amount
            amount.token.address, // _rToken
            this.finalReceiveSide(), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])
        return [portal.address, calldata]
    }

    protected async getFee(feeToken: Token): Promise<TokenAmount> {
        const [receiveSide, calldata] =
            this.transit.direction === 'burn' ? await this.feeBurnCallData() : await this.feeMintCallData() // mint or v2

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: this.transit.isV2() ? MANAGER_CHAIN : this.tokenOut.chainId,
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
        if (this.transit.isV2()) {
            return this.synthesisV2.address
        }
        return this.tradeC?.routerAddress || AddressZero
    }

    protected finalCalldata(): string | [] {
        if (this.transit.isV2()) {
            return this.synthesisV2.interface.encodeFunctionData('metaBurnSyntheticToken', [
                {
                    stableBridgingFee: '0', // uint256 stableBridgingFee; // FIXME pass correct fee
                    amount: this.transit.amountOut.raw.toString(), // uint256 amount;
                    syntCaller: this.from, // address syntCaller;
                    finalReceiveSide: this.tradeC?.routerAddress || AddressZero, // address finalReceiveSide;
                    sToken: this.transit.amountOut.token.address, // address sToken;
                    finalCallData: this.tradeC?.callData || [], // bytes finalCallData;
                    finalOffset: this.tradeC?.callDataOffset || 0, // uint256 finalOffset;
                    chain2address: this.to, // address chain2address;
                    receiveSide: this.symbiosis.portal(this.tokenOut.chainId).address,
                    oppositeBridge: this.symbiosis.bridge(this.tokenOut.chainId).address,
                    revertableAddress: this.revertableAddress,
                    chainID: this.tokenOut.chainId,
                    clientID: this.symbiosis.clientId,
                },
            ])
        } else {
            return this.tradeC?.callData || []
        }
    }

    protected finalOffset(): number {
        if (this.transit.isV2()) {
            return 100
        }
        return this.tradeC?.callDataOffset || 0
    }

    protected swapTokens(): string[] {
        const tokens = [this.transit.route[0].address, this.transit.route[this.transit.route.length - 1].address]

        if (this.tradeC && !this.transit.isV2()) {
            tokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        }
        return tokens
    }
}

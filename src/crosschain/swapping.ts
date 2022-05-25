import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Log, TransactionReceipt, TransactionRequest, TransactionResponse } from '@ethersproject/providers'
import { Signer, BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { Execute, WaitForMined } from './bridging'
import { BIPS_BASE, CHAINS_PRIORITY } from './constants'
import { Error, ErrorCode } from './error'
import { NerveTrade } from './nerveTrade'
import type { Symbiosis } from './symbiosis'
import { BridgeDirection } from './types'
import { UniLikeTrade } from './uniLikeTrade'
import { calculateGasMargin, canOneInch, getExternalId, getInternalId } from './utils'
import { WaitForComplete } from './waitForComplete'
import { AvaxRouter, UniLikeRouter } from './contracts'
import { OneInchTrade } from './oneInchTrade'
import { DataProvider } from './dataProvider'

export type SwapExactIn = Promise<{
    execute: (signer: Signer) => Execute
    fee: TokenAmount
    tokenAmountOut: TokenAmount
    tokenAmountOutWithZeroFee: TokenAmount
    route: Token[]
    priceImpact: Percent
    amountInUsd: TokenAmount
    transactionRequest: TransactionRequest
}>

export class Swapping {
    protected from!: string
    protected to!: string
    protected revertableAddress!: string
    protected tokenAmountIn!: TokenAmount
    protected tokenOut!: Token
    protected slippage!: number
    protected deadline!: number
    protected ttl!: number
    protected direction!: BridgeDirection
    protected use1Inch!: boolean

    protected route!: Token[]
    protected feeToken!: Token

    protected tradeA: UniLikeTrade | OneInchTrade | undefined
    protected tradeB!: NerveTrade
    protected tradeC: UniLikeTrade | OneInchTrade | undefined

    public amountInUsd: TokenAmount | undefined

    protected readonly symbiosis: Symbiosis

    public constructor(symbiosis: Symbiosis) {
        this.symbiosis = symbiosis
    }

    public async exactIn(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = false
    ): SwapExactIn {
        // TODO check slippage.
        //  if slippage too low, the first swap will failed

        this.use1Inch = use1Inch
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.revertableAddress = revertableAddress
        this.slippage = slippage
        this.deadline = deadline
        this.ttl = deadline - Math.floor(Date.now() / 1000)
        this.direction = Swapping.getDirection(tokenAmountIn, tokenOut)

        const dataProvider = new DataProvider(this.symbiosis)

        if (!this.symbiosis.isTransitStable(tokenAmountIn.token)) {
            this.tradeA = this.buildTradeA()
            await this.tradeA.init()
        }

        this.tradeB = await this.buildTradeB(dataProvider)
        await this.tradeB.init(dataProvider)

        if (this.direction === 'burn') {
            this.amountInUsd = this.tradeB.amountOut
        } else {
            this.amountInUsd = this.tradeB.tokenAmountIn
        }
        this.symbiosis.validateSwapAmounts(this.amountInUsd)

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC()
            await this.tradeC.init(dataProvider)
        }

        const zeroFee = new TokenAmount(this.feeToken, '0')
        const tokenAmountOutWithZeroFee = this.tokenAmountOut(zeroFee)

        this.route = this.getRoute()
        const fee = await this.getFee()

        // >>> NOTE create trades with calculated fee
        this.tradeB = await this.buildTradeB(dataProvider, fee)
        await this.tradeB.init(dataProvider)

        if (!this.symbiosis.isTransitStable(tokenOut)) {
            this.tradeC = this.buildTradeC(fee)
            await this.tradeC.init(dataProvider)
        }
        // <<< NOTE create trades with calculated fee

        const transactionRequest = this.getTransactionRequest(fee)

        return {
            execute: (signer: Signer) => this.execute(transactionRequest, signer),
            fee,
            tokenAmountOut: this.tokenAmountOut(fee),
            tokenAmountOutWithZeroFee,
            route: this.route,
            priceImpact: this.calculatePriceImpact(),
            amountInUsd: this.amountInUsd,
            transactionRequest,
        }
    }

    async waitForComplete(receipt: TransactionReceipt): Promise<Log> {
        if (!this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        return new WaitForComplete({
            direction: this.direction,
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

        let firstToken = this.tradeA ? this.tradeA.tokenAmountIn.token.address : this.tokenAmountIn.token.address
        if (!firstToken) {
            // AddressZero if first token is GasToken
            firstToken = AddressZero
        }

        let amount: TokenAmount
        let approvedTokens: string[]
        if (this.direction === 'burn') {
            amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tradeB.tokenAmountIn
            approvedTokens = [firstToken, this.tradeB.route[0].address, this.tradeB.route[1].address]
        } else {
            amount = this.tradeA ? this.tradeA.tokenAmountIn : this.tokenAmountIn
            approvedTokens = [
                firstToken,
                this.tradeA ? this.tradeA.amountOut.token.address : this.tokenAmountIn.token.address,
            ]
        }

        const value =
            this.tradeA && this.tokenAmountIn.token.isNative
                ? BigNumber.from(this.tradeA.tokenAmountIn.raw.toString())
                : undefined

        const data = metaRouter.interface.encodeFunctionData('metaRoute', [
            {
                firstSwapCalldata: this.tradeA?.callData || [],
                secondSwapCalldata: this.direction === 'burn' ? this.tradeB.callData : [],
                approvedTokens,
                firstDexRouter: this.tradeA?.routerAddress || AddressZero,
                secondDexRouter: this.tradeB.pool.address,
                amount: amount.raw.toString(),
                nativeIn: amount.token.isNative,
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
        const pib = this.tradeB?.priceImpact || zero
        const pic = this.tradeC?.priceImpact || zero

        // console.log([pia, pib, pic].map((i) => i.toSignificant()))

        let pi = pia.add(pib).add(pic)

        const max = new Percent(JSBI.BigInt(10000), BIPS_BASE) // 100%
        if (pi.greaterThan(max)) pi = max

        return new Percent(pi.numerator, pi.denominator)
    }

    protected tokenAmountOut(fee: TokenAmount): TokenAmount {
        if (this.tradeC) {
            return this.tradeC.amountOut
        }

        if (this.direction === 'burn') {
            const amount = this.burnOtherSideAmount()
            if (amount.lessThan(fee)) {
                throw new Error(
                    `Amount $${amount.toSignificant()} less than fee $${fee.toSignificant()}`,
                    ErrorCode.AMOUNT_LESS_THAN_FEE
                )
            }
            return amount.subtract(fee)
        } else {
            return this.tradeB.amountOut
        }
    }

    protected buildTradeA(): UniLikeTrade | OneInchTrade {
        const chainId = this.tokenAmountIn.token.chainId
        const tokenOut = this.symbiosis.transitStable(chainId)
        const from = this.symbiosis.metaRouter(chainId).address
        const to = from

        if (this.use1Inch && canOneInch(chainId)) {
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(this.tokenAmountIn, tokenOut, from, to, this.slippage / 100, oracle)
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerA: UniLikeRouter | AvaxRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerA = this.symbiosis.avaxRouter(chainId)
        }

        return new UniLikeTrade(this.tokenAmountIn, tokenOut, to, this.slippage, this.ttl, routerA, dexFee)
    }

    protected async buildTradeB(dataProvider: DataProvider, bridgeFee?: TokenAmount): Promise<NerveTrade> {
        let tradeBAmountIn: TokenAmount
        let tradeBTokenOut: Token

        if (this.direction === 'burn') {
            tradeBAmountIn = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn
            const transitStableOut = this.symbiosis.transitStable(this.tokenOut.chainId) // USDC
            this.feeToken = transitStableOut
            const rep = await dataProvider.getRepresentation(transitStableOut, this.tokenAmountIn.token.chainId) // sUSDC
            if (!rep) {
                throw new Error(
                    `Representation of ${transitStableOut.symbol} in chain ${this.tokenAmountIn.token.chainId} not found`,
                    ErrorCode.NO_ROUTE
                )
            }
            tradeBTokenOut = rep
        } else {
            // mint
            const transitStableIn = this.symbiosis.transitStable(this.tokenAmountIn.token.chainId) // USDC
            const rep = await dataProvider.getRepresentation(transitStableIn, this.tokenOut.chainId) // sUSDC
            if (!rep) {
                throw new Error(
                    `Representation of ${transitStableIn.symbol} in chain ${this.tokenOut.chainId} not found`,
                    ErrorCode.NO_ROUTE
                )
            }
            this.feeToken = rep
            tradeBAmountIn = new TokenAmount(rep, this.tradeA ? this.tradeA.amountOut.raw : this.tokenAmountIn.raw) // sUSDC
            if (bridgeFee) {
                if (tradeBAmountIn.lessThan(bridgeFee)) {
                    throw new Error(
                        `Amount $${tradeBAmountIn.toSignificant()} less than fee $${bridgeFee.toSignificant()}`,
                        ErrorCode.AMOUNT_LESS_THAN_FEE
                    )
                }
                tradeBAmountIn = tradeBAmountIn.subtract(bridgeFee)
            }

            tradeBTokenOut = this.symbiosis.transitStable(this.tokenOut.chainId) // BUSD
        }
        const nervePool = this.symbiosis.nervePool(tradeBAmountIn.token, tradeBTokenOut)

        return new NerveTrade(tradeBAmountIn, tradeBTokenOut, this.slippage, this.deadline, nervePool)
    }

    protected buildTradeC(bridgeFee?: TokenAmount) {
        let tradeCAmountIn: TokenAmount
        if (this.direction === 'burn') {
            tradeCAmountIn = this.burnOtherSideAmount()
            if (bridgeFee) {
                if (tradeCAmountIn.lessThan(bridgeFee)) {
                    throw new Error(
                        `Amount $${tradeCAmountIn.toSignificant()} less than fee $${bridgeFee.toSignificant()}`,
                        ErrorCode.AMOUNT_LESS_THAN_FEE
                    )
                }
                tradeCAmountIn = tradeCAmountIn.subtract(bridgeFee)
            }
        } else {
            // mint
            tradeCAmountIn = this.tradeB.amountOut
        }

        const chainId = this.tokenOut.chainId

        if (this.use1Inch && canOneInch(chainId)) {
            const from = this.symbiosis.metaRouter(chainId).address
            const oracle = this.symbiosis.oneInchOracle(chainId)
            return new OneInchTrade(tradeCAmountIn, this.tokenOut, from, this.to, this.slippage / 100, oracle)
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        let routerC: UniLikeRouter | AvaxRouter = this.symbiosis.uniLikeRouter(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            routerC = this.symbiosis.avaxRouter(chainId)
        }

        return new UniLikeTrade(tradeCAmountIn, this.tokenOut, this.to, this.slippage, this.ttl, routerC, dexFee)
    }

    protected burnOtherSideAmount(): TokenAmount {
        if (!this.feeToken) {
            throw new Error('Fee token is not set')
        }
        if (this.direction !== 'burn') {
            throw new Error('Cannot call with direction !== "burn"')
        }
        return new TokenAmount(this.feeToken, this.tradeB.amountOut.raw)
    }

    protected getRoute(): Token[] {
        const started = this.tradeA ? [] : [this.tokenAmountIn.token]
        const terminated = this.tradeC ? [] : [this.tokenOut]

        return [
            ...started,
            ...(this.tradeA ? this.tradeA.route : []),
            ...(this.tradeB ? this.tradeB.route : []),
            ...(this.tradeC ? this.tradeC.route : []),
            ...terminated,
        ].reduce((acc: Token[], token: Token) => {
            const found = acc.find((i) => i.equals(token))
            if (found) return acc
            return [...acc, token]
        }, [])
    }

    protected otherSideBurnCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const synthesis = this.symbiosis.synthesis(this.tokenAmountIn.token.chainId)

        return [
            synthesis.address,
            synthesis.interface.encodeFunctionData('metaBurnSyntheticToken', [
                {
                    stableBridgingFee: fee.raw.toString(),
                    amount: this.burnOtherSideAmount().raw.toString(),
                    syntCaller: this.from,
                    finalReceiveSide: this.finalReceiveSide(),
                    sToken: this.tradeB.amountOut.token.address,
                    finalCallData: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    chain2address: this.to,
                    receiveSide: this.symbiosis.portal(this.tokenOut.chainId).address,
                    oppositeBridge: this.symbiosis.bridge(this.tokenOut.chainId).address,
                    revertableAddress: this.revertableAddress,
                    chainID: this.tokenOut.chainId,
                },
            ]),
        ]
    }

    protected otherSideSynthCallData(fee: TokenAmount): [string, string] {
        if (!this.tokenAmountIn || !this.tokenOut) {
            throw new Error('Tokens are not set')
        }

        const swapTokens = this.tradeB.route.map((i) => i?.address)
        if (this.tradeC) {
            swapTokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        }

        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId
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
                    swapTokens,
                    secondDexRouter: this.tradeB.pool.address,
                    secondSwapCalldata: this.tradeB.callData,
                    finalReceiveSide: this.finalReceiveSide(),
                    finalCalldata: this.finalCalldata(),
                    finalOffset: this.finalOffset(),
                    revertableAddress: this.revertableAddress,
                },
            ]),
        ]
    }

    protected otherSideData(fee: TokenAmount): [string, string] {
        return this.direction === 'burn' ? this.otherSideBurnCallData(fee) : this.otherSideSynthCallData(fee)
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

    protected async feeMintCallData(fee?: TokenAmount): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const portal = this.symbiosis.portal(chainIdIn)
        const portalRequestsCount = (await portal.requestCount()).toNumber()
        const synthesis = this.symbiosis.synthesis(chainIdOut)

        const amount = this.tradeA ? this.tradeA.amountOut : this.tokenAmountIn

        const internalId = getInternalId({
            contractAddress: portal.address,
            requestCount: portalRequestsCount,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: synthesis.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const swapTokens = this.tradeB.route.map((i) => i.address)
        if (this.tradeC) {
            swapTokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        }

        const callData = synthesis.interface.encodeFunctionData('metaMintSyntheticToken', [
            {
                stableBridgingFee: fee?.raw.toString() || '1',
                amount: amount.raw.toString(),
                externalID: externalId,
                tokenReal: amount.token.address,
                chainID: chainIdIn,
                to: this.to,
                swapTokens,
                secondDexRouter: this.tradeB.pool.address,
                secondSwapCalldata: this.tradeB.callData,
                finalReceiveSide: this.finalReceiveSide(),
                finalCalldata: this.finalCalldata(),
                finalOffset: this.finalOffset(),
            },
        ])

        return [synthesis.address, callData]
    }

    protected async feeBurnCallData(fee?: TokenAmount): Promise<[string, string]> {
        const chainIdIn = this.tokenAmountIn.token.chainId
        const chainIdOut = this.tokenOut.chainId

        const synthesis = this.symbiosis.synthesis(chainIdIn)
        const synthesisRequestsCount = (await synthesis.requestCount()).toNumber()

        const portal = this.symbiosis.portal(chainIdOut)

        const token = this.tradeC ? this.tradeC.tokenAmountIn.token : this.tokenOut

        const amount = this.burnOtherSideAmount().raw.toString()

        const internalId = getInternalId({
            contractAddress: synthesis.address,
            requestCount: synthesisRequestsCount,
            chainId: chainIdIn,
        })

        const externalId = getExternalId({
            internalId,
            contractAddress: portal.address,
            revertableAddress: this.revertableAddress,
            chainId: chainIdOut,
        })

        const calldata = portal.interface.encodeFunctionData('metaUnsynthesize', [
            fee?.raw.toString() || '1', // _stableBridgingFee
            externalId, // _externalID,
            this.to, // _to
            amount, // _amount
            token.address, // _rToken
            this.finalReceiveSide(), // _finalReceiveSide
            this.finalCalldata(), // _finalCalldata
            this.finalOffset(), // _finalOffset
        ])
        return [portal.address, calldata]
    }

    protected async getFee(newFee?: TokenAmount): Promise<TokenAmount> {
        const [receiveSide, calldata] =
            this.direction === 'burn' ? await this.feeBurnCallData(newFee) : await this.feeMintCallData(newFee)

        const fee = await this.symbiosis.getBridgeFee({
            receiveSide,
            calldata,
            chainIdFrom: this.tokenAmountIn.token.chainId,
            chainIdTo: this.tokenOut.chainId,
        })
        return new TokenAmount(this.feeToken, fee.toString())
    }

    protected static getDirection(tokenAmountIn: TokenAmount, tokenOut: Token) {
        const indexIn = CHAINS_PRIORITY.indexOf(tokenAmountIn.token.chainId)
        const indexOut = CHAINS_PRIORITY.indexOf(tokenOut.chainId)
        if (indexIn === -1) {
            throw new Error(`Chain ${tokenAmountIn.token.chainId} not found in chains priority`)
        }
        if (indexOut === -1) {
            throw new Error(`Chain ${tokenOut.chainId} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
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
}

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { NerveTrade } from './nerveTrade'
import { Symbiosis } from './symbiosis'
import { DataProvider } from './dataProvider'
import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection } from './types'

export class Transit {
    public direction: BridgeDirection

    public receiveSide: string
    public callData: string | []
    public route: Token[]
    public priceImpact: Percent
    public amountOut!: TokenAmount

    public feeToken!: Token

    protected tradeB: NerveTrade | undefined

    public constructor(
        protected symbiosis: Symbiosis,
        protected dataProvider: DataProvider,
        protected amountIn: TokenAmount,
        protected tokenOut: Token,
        protected slippage: number,
        protected deadline: number,
        protected fee?: TokenAmount
    ) {
        this.direction = Transit.getDirection(amountIn.token.chainId, tokenOut.chainId)
        this.route = []
        this.receiveSide = AddressZero
        this.callData = []
        this.priceImpact = new Percent('0')
    }

    public async init(): Promise<Transit> {
        this.feeToken = await this.getFeeToken()

        if (!this.isTradeRequired()) {
            this.amountOut = this.getBridgeAmountOut() // depends on this.feeToken
            const transitTokenOut = this.symbiosis.transitStable(this.tokenOut.chainId)
            if (this.direction === 'mint') {
                if (!this.tokenOut.equals(transitTokenOut)) {
                    this.route = [transitTokenOut]
                }
            } else {
                this.route = [this.symbiosis.transitStable(this.amountIn.token.chainId)]
            }
        } else {
            this.tradeB = await this.buildTradeB()
            await this.tradeB.init()

            this.receiveSide = this.tradeB.pool.address
            this.callData = this.tradeB.callData
            this.amountOut = this.getTradeBAmountOut()
            this.route = this.tradeB.route
            this.priceImpact = this.tradeB.priceImpact
        }
        this.symbiosis.validateSwapAmounts(this.getBridgeAmountIn())

        return this
    }

    public getBridgeAmountIn(): TokenAmount {
        if (this.direction === 'mint') {
            return this.amountIn
        }

        return this.tradeB ? this.tradeB.amountOut : this.amountIn
    }

    public getBridgeAmountOut(): TokenAmount {
        const amountOut = new TokenAmount(this.feeToken, this.amountIn.raw)
        if (!this.fee) {
            return amountOut
        }
        if (amountOut.lessThan(this.fee)) {
            throw new Error(
                `Amount $${amountOut.toSignificant()} less than fee $${this.fee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return amountOut.subtract(this.fee)
    }

    protected getTradeBAmountOut(): TokenAmount {
        if (!this.tradeB) {
            throw new Error('TradeB is undefined')
        }
        if (this.direction === 'mint') {
            return this.tradeB.amountOut
        }

        const transitStableOut = this.symbiosis.transitStable(this.tokenOut.chainId)
        const amountOut = new TokenAmount(transitStableOut, this.tradeB.amountOut.raw)

        if (!this.fee) {
            return amountOut
        }

        if (amountOut.lessThan(this.fee)) {
            throw new Error(
                `Amount $${amountOut.toSignificant()} less than fee $${this.fee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return amountOut.subtract(this.fee)
    }

    public amount(): TokenAmount {
        return this.amountIn
    }

    protected static getDirection(chainIdIn: ChainId, chainIdOut: ChainId) {
        const indexIn = CHAINS_PRIORITY.indexOf(chainIdIn)
        const indexOut = CHAINS_PRIORITY.indexOf(chainIdOut)
        if (indexIn === -1) {
            throw new Error(`Chain ${chainIdIn} not found in chains priority`)
        }
        if (indexOut === -1) {
            throw new Error(`Chain ${chainIdOut} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
    }

    protected isTradeRequired(): boolean {
        const chainId = this.direction === 'mint' ? this.tokenOut.chainId : this.amountIn.token.chainId
        return this.symbiosis.chainConfig(chainId).nerves.length > 0
    }

    protected async getFeeToken(): Promise<Token> {
        if (this.direction === 'burn' || !this.isTradeRequired()) {
            return this.symbiosis.transitStable(this.tokenOut.chainId) // USDC
        }

        const transitStableIn = this.symbiosis.transitStable(this.amountIn.token.chainId) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableIn, this.tokenOut.chainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableIn.symbol} in chain ${this.tokenOut.chainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected getTradeBAmountIn(): TokenAmount {
        if (this.direction === 'burn') {
            return this.amountIn
        }

        return this.getBridgeAmountOut()
    }

    protected async getTradeBTokenOut(): Promise<Token> {
        if (this.direction === 'mint') {
            return this.symbiosis.transitStable(this.tokenOut.chainId)
        }

        const transitStableOut = this.symbiosis.transitStable(this.tokenOut.chainId) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableOut, this.amountIn.token.chainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableOut.symbol} in chain ${this.amountIn.token.chainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async buildTradeB(): Promise<NerveTrade> {
        const amountIn = this.getTradeBAmountIn()
        const tokenOut = await this.getTradeBTokenOut()

        const nervePool = this.symbiosis.nervePool(amountIn.token, tokenOut)

        return new NerveTrade(amountIn, tokenOut, this.slippage, this.deadline, nervePool, this.symbiosis)
    }
}

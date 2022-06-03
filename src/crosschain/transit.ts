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
    public amountOut: TokenAmount

    public feeToken!: Token

    protected tradeB: NerveTrade | undefined

    public constructor(
        protected symbiosis: Symbiosis,
        protected dataProvider: DataProvider,
        protected amountIn: TokenAmount,
        protected chainIdOut: ChainId,
        protected slippage: number,
        protected deadline: number,
        protected fee?: TokenAmount
    ) {
        this.symbiosis.validateSwapAmounts(this.amountIn)

        this.direction = Transit.getDirection(amountIn.token.chainId, chainIdOut)
        this.route = []
        this.receiveSide = AddressZero
        this.callData = []
        this.priceImpact = new Percent('0')

        const transitStableOut = symbiosis.transitStable(chainIdOut)
        this.amountOut = new TokenAmount(transitStableOut, amountIn.raw)
    }

    public async init(): Promise<Transit> {
        this.feeToken = await this.getFeeToken()

        if (!this.isTradeRequired()) {
            return this
        }

        this.tradeB = await this.buildTradeB()
        await this.tradeB.init(this.dataProvider)
        this.receiveSide = this.tradeB.pool.address
        this.callData = this.tradeB.callData
        this.amountOut = this.tradeB.amountOut
        this.route = this.tradeB.route
        this.priceImpact = this.tradeB.priceImpact

        return this
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
        const chainId = this.direction === 'mint' ? this.chainIdOut : this.amountIn.token.chainId
        return this.symbiosis.chainConfig(chainId).nerves.length > 0
    }

    protected async getFeeToken(): Promise<Token> {
        if (this.direction === 'burn') {
            return this.symbiosis.transitStable(this.chainIdOut) // USDC
        }

        const transitStableIn = this.symbiosis.transitStable(this.amountIn.token.chainId) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableIn, this.chainIdOut) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableIn.symbol} in chain ${this.chainIdOut} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async getTradeBAmountIn(fee?: TokenAmount) {
        if (this.direction === 'burn') {
            return this.amountIn
        }

        const tradeBAmountIn = new TokenAmount(this.feeToken, this.amountIn.raw) // sUSDC
        if (!fee) return tradeBAmountIn

        if (tradeBAmountIn.lessThan(fee)) {
            throw new Error(
                `Amount $${tradeBAmountIn.toSignificant()} less than fee $${fee.toSignificant()}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return tradeBAmountIn.subtract(fee)
    }

    protected async getTradeBTokenOut(): Promise<Token> {
        if (this.direction === 'mint') {
            return this.symbiosis.transitStable(this.chainIdOut)
        }

        const transitStableOut = this.symbiosis.transitStable(this.chainIdOut) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableOut, this.amountIn.token.chainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableOut.symbol} in chain ${this.amountIn.token.chainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async buildTradeB(fee?: TokenAmount): Promise<NerveTrade> {
        const amountIn = await this.getTradeBAmountIn(fee)
        const tokenOut = await this.getTradeBTokenOut()

        const nervePool = this.symbiosis.nervePool(amountIn.token, tokenOut)

        return new NerveTrade(amountIn, tokenOut, this.slippage, this.deadline, nervePool)
    }
}

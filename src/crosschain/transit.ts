import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Symbiosis } from './symbiosis'
import { DataProvider } from './dataProvider'
import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection } from './types'
import { OmniTrade } from './trade'
import { MulticallRouter } from './contracts'

export class Transit {
    public direction: BridgeDirection

    public receiveSide: string
    public callData: string | []
    public route: Token[]
    public priceImpact: Percent
    public amountOut!: TokenAmount

    public feeToken!: Token

    protected trade: OmniTrade | undefined
    protected multicallRouter: MulticallRouter

    public constructor(
        protected symbiosis: Symbiosis,
        protected dataProvider: DataProvider,
        protected amountIn: TokenAmount,
        protected tokenOut: Token,
        protected transitStableIn: Token,
        protected transitStableOut: Token,
        protected slippage: number,
        protected deadline: number,
        protected fee?: TokenAmount
    ) {
        this.direction = Transit.getDirection(
            amountIn.token.chainId,
            tokenOut.chainId,
            symbiosis.omniPoolConfig.chainId
        )
        this.multicallRouter = this.symbiosis.multicallRouter(this.symbiosis.omniPoolConfig.chainId)

        this.route = []
        this.receiveSide = AddressZero
        this.callData = []
        this.priceImpact = new Percent('0')
    }

    public async init(): Promise<Transit> {
        this.feeToken = await this.getFeeToken()

        this.trade = await this.buildTrade()

        this.receiveSide = this.multicallRouter.address
        this.callData = this.buildCalldata()
        this.amountOut = this.getTradeAmountOut()
        this.route = this.trade.route
        this.priceImpact = this.trade.priceImpact

        this.symbiosis.validateSwapAmounts(this.getBridgeAmountIn())

        return this
    }

    public isV2() {
        return this.direction === 'v2'
    }

    /**
     * Amount in stables entering the bridge
     */
    public getBridgeAmountIn(): TokenAmount {
        if (this.direction === 'mint' || this.isV2()) {
            return this.amountIn
        }

        return this.trade ? this.trade.amountOut : this.amountIn
    }

    /**
     * Amount in stables coming out of the bridge
     */
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

    // PROTECTED

    protected static getDirection(chainIdIn: ChainId, chainIdOut: ChainId, omniPoolChainId?: ChainId): BridgeDirection {
        const withManagerChain = chainIdIn === omniPoolChainId || chainIdOut === omniPoolChainId
        if (!withManagerChain) {
            return 'v2'
        }

        const chainsPriorityWithMChain = [...CHAINS_PRIORITY, omniPoolChainId]

        const indexIn = chainsPriorityWithMChain.indexOf(chainIdIn)
        const indexOut = chainsPriorityWithMChain.indexOf(chainIdOut)
        if (indexIn === -1) {
            throw new Error(`Chain ${chainIdIn} not found in chains priority`)
        }
        if (indexOut === -1) {
            throw new Error(`Chain ${chainIdOut} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
    }

    protected buildCalldata(): string {
        if (!this.trade) {
            throw new Error('buildCalldata: trade is undefined')
        }

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.amountIn.raw.toString(),
            [this.trade.callData], // calldata
            [this.trade.pool.address], // receiveSides
            [this.trade.tokenAmountIn.token.address, this.trade.amountOut.token.address], // path
            [100], // offset
            this.symbiosis.metaRouter(this.symbiosis.omniPoolConfig.chainId).address,
        ])
    }

    protected getTradeAmountIn(): TokenAmount {
        if (this.direction === 'burn') {
            return this.amountIn
        }

        return this.getBridgeAmountOut()
    }

    protected getTradeAmountOut(): TokenAmount {
        if (!this.trade) {
            throw new Error('There is no trade')
        }
        if (this.direction === 'mint' || this.isV2()) {
            return this.trade.amountOut
        }

        const amountOut = new TokenAmount(this.transitStableOut, this.trade.amountOut.raw)

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

    protected async getFeeToken(): Promise<Token> {
        const transitStableOutChainId = this.isV2() ? this.symbiosis.omniPoolConfig.chainId : this.tokenOut.chainId

        if (this.direction === 'burn') {
            return this.transitStableOut // USDC | BUSD
        }

        // mint or v2
        const rep = await this.dataProvider.getRepresentation(this.transitStableIn, transitStableOutChainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${this.transitStableIn.chainId}:${this.transitStableIn.symbol} in chain ${transitStableOutChainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async getTradeTokenOut(): Promise<Token> {
        if (this.direction === 'mint') {
            return this.transitStableOut
        }

        const transitStableInChainId = this.isV2() ? this.symbiosis.omniPoolConfig.chainId : this.amountIn.token.chainId
        const rep = await this.dataProvider.getRepresentation(this.transitStableOut, transitStableInChainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${this.transitStableOut.symbol} in chain ${transitStableInChainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async buildTrade(): Promise<OmniTrade> {
        const tokenAmountIn = this.getTradeAmountIn()
        const tokenOut = await this.getTradeTokenOut()

        const to = this.symbiosis.metaRouter(this.symbiosis.omniPoolConfig.chainId).address

        const trade = new OmniTrade(tokenAmountIn, tokenOut, this.slippage, this.deadline, this.symbiosis, to)
        await trade.init()

        return trade
    }
}

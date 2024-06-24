import { Symbiosis } from './symbiosis'
import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection, OmniPoolConfig } from './types'
import { OmniTrade } from './trade'

export class Transit {
    public direction: BridgeDirection

    public route: Token[]
    public priceImpact: Percent
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public feeToken!: Token
    public trade: OmniTrade | undefined

    public constructor(
        protected symbiosis: Symbiosis,
        public amountIn: TokenAmount,
        public amountInMin: TokenAmount,
        public tokenOut: Token,
        protected transitTokenIn: Token,
        protected transitTokenOut: Token,
        protected slippage: number,
        protected deadline: number,
        protected omniPoolConfig: OmniPoolConfig,
        protected fee?: TokenAmount
    ) {
        this.direction = Transit.getDirection(amountIn.token.chainId, tokenOut.chainId, omniPoolConfig.chainId)

        this.route = []
        this.priceImpact = new Percent('0')
    }

    public async init(): Promise<Transit> {
        this.feeToken = this.getFeeToken()

        this.trade = await this.buildTrade()

        this.amountOut = this.getTradeAmountOut(this.trade.amountOut)
        this.amountOutMin = this.getTradeAmountOut(this.trade.amountOutMin)
        this.route = this.trade.route
        this.priceImpact = this.trade.priceImpact

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
    public getBridgeAmountOut(amount: TokenAmount): TokenAmount {
        const amountOut = new TokenAmount(this.feeToken, amount.raw)
        if (!this.fee) {
            return amountOut
        }
        if (amountOut.lessThan(this.fee) || amountOut.equalTo(this.fee)) {
            throw new Error(
                `Amount ${amountOut.toSignificant()} ${
                    amountOut.token.symbol
                } less than fee ${this.fee.toSignificant()} ${this.fee.token.symbol}`,
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

    protected getTradeAmountIn(amount: TokenAmount): TokenAmount {
        if (this.direction === 'burn') {
            return amount
        }

        return this.getBridgeAmountOut(amount)
    }

    protected getTradeAmountOut(tradeAmountOut: TokenAmount | undefined): TokenAmount {
        if (!tradeAmountOut) {
            throw new Error('There is no trade')
        }
        if (this.direction === 'mint' || this.isV2()) {
            return tradeAmountOut
        }

        const amountOut = new TokenAmount(this.transitTokenOut, tradeAmountOut.raw)

        if (!this.fee) {
            return amountOut
        }

        if (amountOut.lessThan(this.fee) || amountOut.equalTo(this.fee)) {
            throw new Error(
                `Amount ${amountOut.toSignificant()} ${
                    amountOut.token.symbol
                } less than fee ${this.fee.toSignificant()} ${this.fee.token.symbol}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return amountOut.subtract(this.fee)
    }

    protected getFeeToken(): Token {
        const transitTokenOutChainId = this.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId

        if (this.direction === 'burn') {
            return this.transitTokenOut // USDC | BUSD
        }

        // mint or v2
        const rep = this.symbiosis.getRepresentation(this.transitTokenIn, transitTokenOutChainId) // sToken
        if (!rep) {
            throw new Error(
                `Representation of ${this.transitTokenIn.chainId}:${this.transitTokenIn.symbol} in chain ${transitTokenOutChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return rep
    }

    protected getTradeTokenOut(): Token {
        if (this.direction === 'mint') {
            return this.transitTokenOut
        }

        const transitTokenInChainId = this.isV2() ? this.omniPoolConfig.chainId : this.amountIn.token.chainId
        const rep = this.symbiosis.getRepresentation(this.transitTokenOut, transitTokenInChainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${this.transitTokenOut.symbol} in chain ${transitTokenInChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return rep
    }

    protected async buildTrade(): Promise<OmniTrade> {
        const tokenAmountIn = this.getTradeAmountIn(this.amountIn)
        const tokenAmountInMin = this.getTradeAmountIn(this.amountInMin)
        const tokenOut = this.getTradeTokenOut()

        const to = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId).address

        const trade = new OmniTrade(
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            this.slippage,
            this.deadline,
            this.symbiosis,
            to,
            this.omniPoolConfig
        )
        await trade.init()

        return trade
    }

    public calls() {
        if (!this.trade) {
            return undefined
        }

        const calldatas = []
        const receiveSides = []
        const paths = []
        const offsets = []

        const preCall = OmniTrade.buildFeeCall(this.trade.tokenAmountIn)
        if (preCall) {
            calldatas.push(preCall.calldata)
            receiveSides.push(preCall.receiveSide)
            paths.push(preCall.path)
            offsets.push(preCall.offset)
        }

        calldatas.push(this.trade.callData)
        receiveSides.push(this.trade.pool.address)
        paths.push(...[this.trade.tokenAmountIn.token.address, this.trade.amountOut.token.address])
        offsets.push(this.trade.callDataOffset)

        const postCall = OmniTrade.buildFeeCall(this.trade.amountOut)
        if (postCall) {
            calldatas.push(postCall.calldata)
            receiveSides.push(postCall.receiveSide)
            paths.push(postCall.path)
            offsets.push(postCall.offset)
        }

        return {
            calldatas,
            receiveSides,
            paths,
            offsets,
        }
    }
}

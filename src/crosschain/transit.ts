import { Symbiosis } from './symbiosis'
import { Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection, OmniPoolConfig } from './types'
import { OctoPoolTrade } from './trade'

export class Transit {
    public direction: BridgeDirection
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public trade!: OctoPoolTrade
    public feeToken1: Token
    public feeToken2: Token | undefined

    public constructor(
        protected symbiosis: Symbiosis,
        public amountIn: TokenAmount,
        public amountInMin: TokenAmount,
        public tokenOut: Token,
        protected slippage: number,
        protected deadline: number,
        protected omniPoolConfig: OmniPoolConfig,
        public fee1?: TokenAmount,
        public fee2?: TokenAmount
    ) {
        this.direction = Transit.getDirection(amountIn.token.chainId, tokenOut.chainId, omniPoolConfig.chainId)

        this.feeToken1 = this.getFeeToken1()
        this.feeToken2 = this.getFeeToken2()
    }

    public async init(): Promise<Transit> {
        this.trade = await this.buildTrade()

        this.amountOut = this.getAmountOut(this.trade.amountOut)
        this.amountOutMin = this.getAmountOut(this.trade.amountOutMin)

        return this
    }

    public isV2() {
        return this.direction === 'v2'
    }

    public calls() {
        if (!this.trade) {
            return undefined
        }

        const calldatas = []
        const receiveSides = []
        const paths = []
        const offsets = []

        const preCall = this.trade.buildFeePreCall()
        if (preCall) {
            calldatas.push(preCall.calldata)
            receiveSides.push(preCall.receiveSide)
            paths.push(preCall.path)
            offsets.push(preCall.offset)
        }

        // octopool swap
        calldatas.push(this.trade.callData)
        receiveSides.push(this.trade.routerAddress)
        paths.push(...[this.trade.tokenAmountIn.token.address, this.trade.amountOut.token.address])
        offsets.push(this.trade.callDataOffset)

        const postCall = this.trade.buildFeePostCall()
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

    public getBridgeAmountIn(): TokenAmount {
        if (this.direction === 'burn') {
            return this.trade.amountOut
        }

        return this.amountIn
    }

    public applyFees(fee1: TokenAmount, fee2?: TokenAmount) {
        if (!fee1.token.equals(this.feeToken1)) {
            throw new Error('Incorrect fee1 token')
        }
        this.fee1 = fee1

        if (this.isV2()) {
            if (!fee2) {
                throw new Error('fee2 should be passed')
            }
            if (!this.feeToken2) {
                throw new Error('feeToken2 should have been initialized')
            }
            if (!fee2.token.equals(this.feeToken2)) {
                throw new Error('Incorrect fee2 token')
            }
            this.fee2 = fee2
        }

        const newAmountIn = this.getTradeAmountIn(this.amountIn)
        this.trade.applyAmountIn(newAmountIn)

        this.amountOut = this.getAmountOut(this.trade.amountOut)
        this.amountOutMin = this.getAmountOut(this.trade.amountOutMin)
    }

    // PRIVATE

    private getFeeToken1(): Token {
        if (this.direction === 'burn') {
            return this.tokenOut
        }

        const tokenIn = this.amountIn.token
        const sTokenChainId = this.isV2() ? this.omniPoolConfig.chainId : this.tokenOut.chainId
        const sToken = this.symbiosis.getRepresentation(tokenIn, sTokenChainId)
        if (!sToken) {
            throw new Error(
                `Representation of ${tokenIn.chainId}:${tokenIn.symbol} in chain ${sTokenChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return sToken
    }

    private getFeeToken2(): Token | undefined {
        if (!this.isV2()) {
            return
        }

        return this.tokenOut
    }

    private getAmountOut(tradeAmountOut: TokenAmount | undefined): TokenAmount {
        if (!tradeAmountOut) {
            throw new Error('There is no trade')
        }
        if (this.direction === 'mint') {
            return tradeAmountOut
        }

        const amountOut = new TokenAmount(this.tokenOut, tradeAmountOut.raw)

        let fee = this.fee1
        if (this.isV2()) {
            fee = this.fee2
        }
        if (!fee) {
            return amountOut
        }

        if (amountOut.lessThan(fee) || amountOut.equalTo(fee)) {
            throw new Error(
                `Amount ${amountOut.toSignificant()} ${amountOut.token.symbol} less than fee ${fee.toSignificant()} ${
                    fee.token.symbol
                }`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return amountOut.subtract(fee)
    }

    private getTradeAmountIn(amount: TokenAmount): TokenAmount {
        if (this.direction === 'burn') {
            return amount
        }

        const amountOut = new TokenAmount(this.feeToken1, amount.raw)
        if (!this.fee1) {
            return amountOut
        }
        if (amountOut.lessThan(this.fee1) || amountOut.equalTo(this.fee1)) {
            throw new Error(
                `Amount ${amountOut.toSignificant()} ${
                    amountOut.token.symbol
                } less than fee ${this.fee1.toSignificant()} ${this.fee1.token.symbol}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        return amountOut.subtract(this.fee1)
    }

    private getTradeTokenOut(): Token {
        if (this.direction === 'mint') {
            return this.tokenOut
        }

        const sTokenChainId = this.isV2() ? this.omniPoolConfig.chainId : this.amountIn.token.chainId
        const sToken = this.symbiosis.getRepresentation(this.tokenOut, sTokenChainId)
        if (!sToken) {
            throw new Error(
                `Representation of ${this.tokenOut.symbol} in chain ${sTokenChainId} not found`,
                ErrorCode.NO_REPRESENTATION_FOUND
            )
        }
        return sToken
    }

    private async buildTrade(): Promise<OctoPoolTrade> {
        const tokenAmountIn = this.getTradeAmountIn(this.amountIn)
        const tokenAmountInMin = this.getTradeAmountIn(this.amountInMin)
        const tokenOut = this.getTradeTokenOut()

        const to = this.symbiosis.multicallRouter(this.omniPoolConfig.chainId).address

        const trade = new OctoPoolTrade(
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

    private static getDirection(chainIdIn: ChainId, chainIdOut: ChainId, omniPoolChainId?: ChainId): BridgeDirection {
        const withHostChain = chainIdIn === omniPoolChainId || chainIdOut === omniPoolChainId
        if (!withHostChain) {
            return 'v2'
        }

        const chainsPriorityWithHostChain = [...CHAINS_PRIORITY, omniPoolChainId]

        const indexIn = chainsPriorityWithHostChain.indexOf(chainIdIn)
        const indexOut = chainsPriorityWithHostChain.indexOf(chainIdOut)
        if (indexIn === -1) {
            throw new Error(`Chain ${chainIdIn} not found in chains priority`)
        }
        if (indexOut === -1) {
            throw new Error(`Chain ${chainIdOut} not found in chains priority`)
        }

        return indexIn > indexOut ? 'burn' : 'mint'
    }
}

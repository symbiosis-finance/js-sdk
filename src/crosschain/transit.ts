import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { NerveTrade } from './nerveTrade'
import { Symbiosis } from './symbiosis'
import { DataProvider } from './dataProvider'
import { Percent, Token, TokenAmount } from '../entities'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { CHAINS_PRIORITY } from './constants'
import { BridgeDirection } from './types'
import { MulticallRouter } from './contracts'

export class Transit {
    public direction: BridgeDirection

    public receiveSide: string
    public callData: string | []
    public route: Token[]
    public priceImpact: Percent
    public amountOut!: TokenAmount

    public feeToken!: Token

    protected trades: NerveTrade[] | undefined
    protected multicallRouter: MulticallRouter

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

        this.multicallRouter = this.symbiosis.multicallRouter(this.symbiosis.mChainId)

        this.route = []
        this.receiveSide = AddressZero
        this.callData = []
        this.priceImpact = new Percent('0')
    }

    public async init(): Promise<Transit> {
        this.feeToken = await this.getFeeToken()

        if (this.isTradesRequired()) {
            this.trades = await this.buildTrades()

            this.receiveSide = this.multicallRouter.address
            this.callData = this.buildCalldata()
            this.amountOut = this.getTradeAmountOut()
            this.route = this.buildRoute()
            this.priceImpact = this.calculatePriceImpact()
        } else {
            this.amountOut = this.getBridgeAmountOut() // depends on this.feeToken
            const transitTokenOut = this.symbiosis.transitStable(this.tokenOut.chainId)
            if (this.direction === 'mint') {
                if (!this.tokenOut.equals(transitTokenOut)) {
                    this.route = [transitTokenOut]
                }
            } else {
                this.route = [this.symbiosis.transitStable(this.amountIn.token.chainId)]
            }
        }
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

        return this.trades ? this.getLastTradeAmountOut() : this.amountIn
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

    protected static getDirection(chainIdIn: ChainId, chainIdOut: ChainId, mChainId?: ChainId): BridgeDirection {
        const withManagerChain = chainIdIn === mChainId || chainIdOut === mChainId
        if (!withManagerChain) {
            return 'v2'
        }

        const chainsPriorityWithMChain = [...CHAINS_PRIORITY, mChainId]

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
        if (!this.trades) {
            throw new Error('buildCalldata: trades is undefined')
        }

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.amountIn.raw.toString(),
            this.trades.map((i) => i.callData), // calldata
            this.trades.map((i) => i.pool.address), // receiveSides
            [
                ...this.trades.map((i) => i.tokenAmountIn.token.address),
                this.getLastTradeAmountOut().token.address, // output token
            ], // path
            this.trades.map(() => 100), // offset
            this.symbiosis.metaRouter(this.symbiosis.mChainId).address,
        ])
    }

    protected buildRoute(): Token[] {
        if (!this.trades) {
            throw new Error('buildRoute: trades is undefined')
        }
        const route: Token[] = []
        this.trades.forEach((i) => {
            route.push(i.tokenAmountIn.token)
            route.push(i.amountOut.token)
        })

        return route.reduce((acc: Token[], token) => {
            for (let i = 0; i < acc.length; i++) {
                if (acc[i].equals(token)) {
                    return acc
                }
            }
            acc.push(token)
            return acc
        }, [])
    }

    protected calculatePriceImpact(): Percent {
        if (!this.trades) {
            throw new Error('calculatePriceImpact: trades is undefined')
        }
        return this.trades.reduce((acc, i) => {
            return acc.add(i.priceImpact)
        }, new Percent('0'))
    }

    protected isTradesRequired(): boolean {
        if (this.isV2()) {
            return true
        }
        const chainId = this.direction === 'mint' ? this.tokenOut.chainId : this.amountIn.token.chainId
        return this.symbiosis.chainConfig(chainId).nerves.length > 0
    }

    protected getTradeAmountIn(): TokenAmount {
        if (this.direction === 'burn') {
            return this.amountIn
        }

        return this.getBridgeAmountOut()
    }

    protected getTradeAmountOut(): TokenAmount {
        const amount = this.getLastTradeAmountOut()
        if (this.direction === 'mint' || this.isV2()) {
            return amount
        }

        const transitStableOut = this.symbiosis.transitStable(this.tokenOut.chainId)
        const amountOut = new TokenAmount(transitStableOut, amount.raw)

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

    protected getLastTradeAmountOut() {
        if (!this.trades) {
            throw new Error('getLastTradeAmountOut: trades is undefined')
        }
        return this.trades[this.trades.length - 1].amountOut
    }

    protected async getFeeToken(): Promise<Token> {
        const transitStableOutChainId = this.isV2() ? this.symbiosis.mChainId : this.tokenOut.chainId

        if (this.direction === 'burn' || !this.isTradesRequired()) {
            return this.symbiosis.transitStable(transitStableOutChainId) // USDC | BUSD
        }

        // mint or v2
        const transitStableIn = this.symbiosis.transitStable(this.amountIn.token.chainId) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableIn, transitStableOutChainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableIn.chainId}:${transitStableIn.symbol} in chain ${transitStableOutChainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async getTradeTokenOut(): Promise<Token> {
        if (this.direction === 'mint') {
            return this.symbiosis.transitStable(this.tokenOut.chainId)
        }

        const transitStableInChainId = this.isV2() ? this.symbiosis.mChainId : this.amountIn.token.chainId
        const transitStableOut = this.symbiosis.transitStable(this.tokenOut.chainId) // USDC
        const rep = await this.dataProvider.getRepresentation(transitStableOut, transitStableInChainId) // sUSDC
        if (!rep) {
            throw new Error(
                `Representation of ${transitStableOut.symbol} in chain ${transitStableInChainId} not found`,
                ErrorCode.NO_ROUTE
            )
        }
        return rep
    }

    protected async buildTrades(): Promise<NerveTrade[]> {
        const amountIn = this.getTradeAmountIn()
        const tokenOut = await this.getTradeTokenOut()

        if (!this.isV2()) {
            const nervePool = this.symbiosis.nervePool(amountIn.token, tokenOut)
            const nerveTrade = new NerveTrade(
                amountIn,
                tokenOut,
                this.slippage,
                this.deadline,
                nervePool,
                this.symbiosis
            )
            await nerveTrade.init()

            return [nerveTrade]
        }

        const mStable = this.symbiosis.transitStable(this.symbiosis.mChainId)

        const nervePool1 = this.symbiosis.nervePool(amountIn.token, mStable)
        const nerveTrade1 = new NerveTrade(amountIn, mStable, this.slippage, this.deadline, nervePool1, this.symbiosis)
        await nerveTrade1.init()

        const nervePool2 = this.symbiosis.nervePool(mStable, tokenOut)
        const nerveTrade2 = new NerveTrade(
            nerveTrade1.amountOut,
            tokenOut,
            this.slippage,
            this.deadline,
            nervePool2,
            this.symbiosis
        )
        await nerveTrade2.init()

        return [nerveTrade1, nerveTrade2]
    }
}

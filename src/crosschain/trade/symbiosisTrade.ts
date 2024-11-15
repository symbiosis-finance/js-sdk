import JSBI from 'jsbi'
import { Percent, Token, TokenAmount } from '../../entities'
import { patchCalldata } from '../chainUtils'

export type SymbiosisTradeType =
    | 'uni-v2'
    | 'uni-v3'
    | '1inch'
    | 'open-ocean'
    | 'wrap'
    | 'izumi'
    | 'magpie'
    | 'octopool'
    | 'symbiosis'
    | 'thorchain-bridge'

export type SymbiosisKind = 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge' | 'from-btc-swap'

export interface SymbiosisTradeParams {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
}

export interface SymbiosisTradeOutResult {
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    routerAddress: string
    route: Token[]
    priceImpact: Percent
    callData: string
    callDataOffset: number
    minReceivedOffset: number
    functionSelector?: string
}

class TradeNotInitializedError extends Error {
    constructor() {
        super('Trade is not initialized')
    }
}

export abstract class SymbiosisTrade {
    public tokenAmountIn: TokenAmount
    public tokenOut: Token
    public to: string
    public slippage: number

    protected out?: SymbiosisTradeOutResult

    protected constructor({ tokenAmountIn, tokenOut, to, slippage }: SymbiosisTradeParams) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
    }

    get tradeType(): SymbiosisTradeType {
        throw new Error('Implement me')
    }

    public async init(): Promise<this> {
        throw new Error('Implement me')
    }

    get amountOut(): TokenAmount {
        this.assertTradeInitialized()
        return this.out.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertTradeInitialized()
        return this.out.amountOutMin
    }

    get routerAddress(): string {
        this.assertTradeInitialized()
        return this.out.routerAddress
    }

    get route(): Token[] {
        this.assertTradeInitialized()
        return this.out.route
    }

    get callData(): string {
        this.assertTradeInitialized()
        return this.out.callData
    }

    get callDataOffset(): number {
        this.assertTradeInitialized()
        return this.out.callDataOffset
    }

    get minReceivedOffset(): number {
        this.assertTradeInitialized()
        return this.out.minReceivedOffset
    }

    get priceImpact(): Percent {
        this.assertTradeInitialized()
        return this.out.priceImpact
    }

    get functionSelector(): string | undefined {
        this.assertTradeInitialized()
        return this.out.functionSelector
    }

    public applyAmountIn(newAmount: TokenAmount) {
        this.assertTradeInitialized()

        const originalAmount = this.tokenAmountIn
        const proportionally = (a: TokenAmount) => {
            const raw = JSBI.divide(JSBI.multiply(a.raw, newAmount.raw), originalAmount.raw)
            return new TokenAmount(a.token, raw)
        }
        const newAmountOut = proportionally(this.amountOut)
        const newAmountOutMin = proportionally(this.amountOutMin)

        let callData = this.callData
        if (this.minReceivedOffset > 0) {
            callData = patchCalldata(callData, this.minReceivedOffset, newAmountOutMin)
        }
        if (this.callDataOffset > 0) {
            callData = patchCalldata(callData, this.callDataOffset, newAmount)
        }

        this.tokenAmountIn = newAmount
        this.out = {
            ...this.out,
            amountOut: newAmountOut,
            amountOutMin: newAmountOutMin,
            callData,
        }
    }

    private assertTradeInitialized(): asserts this is {
        out: SymbiosisTradeOutResult
    } {
        if (!this.out) {
            throw new TradeNotInitializedError()
        }
    }
}

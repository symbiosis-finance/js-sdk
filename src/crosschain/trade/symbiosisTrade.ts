import JSBI from 'jsbi'
import { Percent, Token, TokenAmount } from '../../entities'
import { patchCalldata } from '../chainUtils'
import { BigNumber } from 'ethers'

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

class OutNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Out is not initialized: ${msg}`)
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
        this.assertOutInitialized('amountOut')
        return this.out.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertOutInitialized('amountOutMin')
        return this.out.amountOutMin
    }

    get routerAddress(): string {
        this.assertOutInitialized('routerAddress')
        return this.out.routerAddress
    }

    get route(): Token[] {
        this.assertOutInitialized('route')
        return this.out.route
    }

    get callData(): string {
        this.assertOutInitialized('callData')
        return this.out.callData
    }

    get callDataOffset(): number {
        this.assertOutInitialized('callDataOffset')
        return this.out.callDataOffset
    }

    get minReceivedOffset(): number {
        this.assertOutInitialized('minReceivedOffset')
        return this.out.minReceivedOffset
    }

    get priceImpact(): Percent {
        this.assertOutInitialized('priceImpact')
        return this.out.priceImpact
    }

    get functionSelector(): string | undefined {
        this.assertOutInitialized('functionSelector')
        return this.out.functionSelector
    }

    public applyAmountIn(newAmount: TokenAmount) {
        this.assertOutInitialized('applyAmountIn')

        const originalAmount = this.tokenAmountIn
        const proportionally = (a: TokenAmount) => {
            const raw = JSBI.divide(JSBI.multiply(a.raw, newAmount.raw), originalAmount.raw)
            return new TokenAmount(a.token, raw)
        }
        const getAmountFromCallData = (data: string, bytesOffset: number): string => {
            let hexPrefix = 0
            if (data.startsWith('0x')) {
                hexPrefix += 2
            }
            const stringOffset = bytesOffset * 2 + hexPrefix

            const amountWidth = 64
            const amountString = '0x' + data.substring(stringOffset - amountWidth, stringOffset)
            return BigNumber.from(amountString).toString()
        }

        const newAmountOut = proportionally(this.amountOut)

        let newAmountOutMin = this.amountOutMin
        let callData = this.callData
        if (this.minReceivedOffset > 0) {
            const minReceivedFromCallDataRaw = getAmountFromCallData(callData, this.minReceivedOffset)
            const minReceivedFromCallData = new TokenAmount(this.amountOutMin.token, minReceivedFromCallDataRaw)
            newAmountOutMin = proportionally(minReceivedFromCallData)
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

    private assertOutInitialized(msg?: string): asserts this is {
        out: SymbiosisTradeOutResult
    } {
        if (!this.out) {
            throw new OutNotInitializedError(msg)
        }
    }
}

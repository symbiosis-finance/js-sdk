import { Percent, Token, TokenAmount } from '../../entities'
import { BigNumber } from 'ethers'
import { Address, FeeItem } from '../types'
import { TradeError } from '../sdkError'

export type SymbiosisTradeType =
    | 'uni-v2'
    | 'uni-v3'
    | '1inch'
    | 'open-ocean'
    | 'wrap'
    | 'izumi'
    | 'octopool'
    | 'symbiosis'
    | 'thorchain-bridge'
    | 'chainflip-bridge'
    | 'raydium'
    | 'stonfi'
    | 'dedust'
    | 'jupiter'
    | 'depository'

export type SymbiosisKind = 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge' | 'from-btc-swap'

export interface SymbiosisTradeParams {
    tokenAmountIn: TokenAmount
    tokenAmountInMin: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
}

export interface SymbiosisTradeOutResult {
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    routerAddress: Address
    route: Token[]
    priceImpact: Percent
    callData: string
    callDataOffset: number
    minReceivedOffset: number
    minReceivedOffset2?: number
    functionSelector?: string
    instructions?: string
    fees?: FeeItem[]
    value?: bigint
}

class OutNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Out is not initialized: ${msg}`)
    }
}

export abstract class SymbiosisTrade {
    public tokenAmountIn: TokenAmount
    public tokenAmountInMin: TokenAmount
    public tokenOut: Token
    public to: string
    public slippage: number

    protected out?: SymbiosisTradeOutResult

    protected constructor({ tokenAmountIn, tokenAmountInMin, tokenOut, to, slippage }: SymbiosisTradeParams) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenAmountInMin = tokenAmountInMin
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
    }

    get tradeType(): SymbiosisTradeType {
        throw new TradeError('Implement me')
    }

    public async init(): Promise<this> {
        throw new TradeError('Implement me')
    }

    get amountOut(): TokenAmount {
        this.assertOutInitialized('amountOut')
        return this.out.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertOutInitialized('amountOutMin')
        return this.out.amountOutMin
    }

    get routerAddress(): Address {
        this.assertOutInitialized('routerAddress')
        return this.out.routerAddress
    }

    get value(): bigint | undefined {
        this.assertOutInitialized('value')
        return this.out.value
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

    get minReceivedOffset2(): number {
        this.assertOutInitialized('minReceivedOffset2')
        return this.out.minReceivedOffset2 || 0
    }

    get priceImpact(): Percent {
        this.assertOutInitialized('priceImpact')
        return this.out.priceImpact
    }

    get functionSelector(): string | undefined {
        this.assertOutInitialized('functionSelector')
        return this.out.functionSelector
    }

    get instructions(): string | undefined {
        this.assertOutInitialized('instructions')
        return this.out.instructions
    }

    get fees(): FeeItem[] | undefined {
        this.assertOutInitialized('fees')
        return this.out.fees
    }

    public applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount) {
        this.assertOutInitialized('applyAmountIn')

        // >>> amountIn
        const amountInBn = BigNumber.from(this.tokenAmountIn.raw.toString())
        const proportionallyBn = (value: BigNumber) => {
            const newAmountInBn = BigNumber.from(newAmountIn.raw.toString())
            return value.mul(newAmountInBn).div(amountInBn)
        }
        const proportionally = (value: TokenAmount) => {
            return new TokenAmount(value.token, proportionallyBn(BigNumber.from(value.raw.toString())).toString())
        }
        const newAmountOut = proportionally(this.amountOut)

        // >>> amountInMin
        const amountInMinBn = BigNumber.from(this.tokenAmountInMin.raw.toString())
        const proportionallyMinBn = (value: BigNumber) => {
            const newAmountInMinBn = BigNumber.from(newAmountInMin.raw.toString())
            return value.mul(newAmountInMinBn).div(amountInMinBn)
        }
        const proportionallyMin = (value: TokenAmount) => {
            return new TokenAmount(value.token, proportionallyMinBn(BigNumber.from(value.raw.toString())).toString())
        }
        const newAmountOutMin = proportionallyMin(this.amountOutMin)

        let callData = this.callData
        if (this.minReceivedOffset > 0) {
            const minReceivedFromCallDataRaw = SymbiosisTrade.getAmountFromCallData(callData, this.minReceivedOffset)
            callData = SymbiosisTrade.patchCallData(
                callData,
                this.minReceivedOffset,
                proportionallyMinBn(minReceivedFromCallDataRaw)
            )
        }
        // NOTE: probably there is a better solution
        if (this.minReceivedOffset2 > 0) {
            const minReceived2FromCallDataRaw = SymbiosisTrade.getAmountFromCallData(callData, this.minReceivedOffset2)
            callData = SymbiosisTrade.patchCallData(
                callData,
                this.minReceivedOffset2,
                proportionallyMinBn(minReceived2FromCallDataRaw)
            )
        }
        if (this.callDataOffset > 0) {
            const amountInFromCallDataRaw = SymbiosisTrade.getAmountFromCallData(callData, this.callDataOffset)
            callData = SymbiosisTrade.patchCallData(
                callData,
                this.callDataOffset,
                proportionallyBn(amountInFromCallDataRaw)
            )
        }

        this.tokenAmountIn = newAmountIn
        this.tokenAmountInMin = newAmountInMin
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

    public static getAmountFromCallData(data: string, bytesOffset: number): BigNumber {
        let hexPrefix = 0
        if (data.startsWith('0x')) {
            hexPrefix += 2
        }
        const stringOffset = bytesOffset * 2 + hexPrefix

        const amountWidth = 64
        const amountString = '0x' + data.substring(stringOffset - amountWidth, stringOffset)
        return BigNumber.from(amountString)
    }

    public static patchCallData(data: string, bytesOffset: number, amount: BigNumber) {
        let hexPrefix = 0
        if (data.startsWith('0x')) {
            hexPrefix += 2
        }
        const stringOffset = bytesOffset * 2 + hexPrefix
        if (data.length < stringOffset) {
            throw new TradeError('offset is to big')
        }
        const amountWidth = 64
        const stringAmount = amount.toHexString().substring(2).padStart(amountWidth, '0').toLowerCase()
        if (stringAmount.length !== amountWidth) {
            throw new TradeError('amount is to wide')
        }

        return data.substring(0, stringOffset - amountWidth) + stringAmount + data.substring(stringOffset)
    }
}

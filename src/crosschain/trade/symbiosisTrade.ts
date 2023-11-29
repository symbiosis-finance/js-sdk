import { Percent, Token, TokenAmount } from '../../entities'

export type SymbiosisTradeType = 'dex' | '1inch' | 'open-ocean' | 'wrap' | 'izumi' | 'okx' | 'thor-chain'

export interface SymbiosisTrade {
    init(): Promise<this>
    tradeType: SymbiosisTradeType
    callData: string
    tokenAmountIn: TokenAmount
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    route: Token[]
    priceImpact: Percent
    routerAddress: string
    callDataOffset?: number
    functionSelector?: string
}

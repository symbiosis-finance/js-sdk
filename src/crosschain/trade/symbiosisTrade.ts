import { Percent, Token, TokenAmount } from '../../entities'

export type SymbiosisKind = 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge' | 'from-btc-swap'

export type SymbiosisTradeType =
    | 'dex'
    | '1inch'
    | 'open-ocean'
    | 'wrap'
    | 'izumi'
    | 'okx'
    | 'uni-v3'
    | 'magpie'
    | 'symbiosis'
    | 'ton-bridge'
    | 'thorchain-bridge'

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

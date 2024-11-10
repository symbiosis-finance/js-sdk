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

import { Percent, Token, TokenAmount } from '../../entities'

export type SymbiosisKind = 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge' | 'from-btc-swap'

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
    minReceivedOffset?: number
    functionSelector?: string
}

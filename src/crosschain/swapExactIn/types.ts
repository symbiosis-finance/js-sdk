import { TransactionRequest } from '@ethersproject/providers'
import { Percent, Token, TokenAmount } from '../../entities'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTradeType } from '../trade'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { TronTransactionData } from '../tron'

export interface SwapExactInParams {
    symbiosis: Symbiosis
    fromAddress: string
    toAddress: string
    inTokenAmount: TokenAmount
    outToken: Token
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export type SwapExactInTransactionPayload =
    | {
          transactionType: 'evm'
          transactionRequest: TransactionRequest
      }
    | {
          transactionType: 'tron'
          transactionRequest: TronTransactionData
      }

export type SwapExactInResult = {
    kind: 'onchain-swap' | 'crosschain-swap' | 'wrap' | 'unwrap' | 'bridge'
    route: Token[]
    tokenAmountOut: TokenAmount
    tokenAmountOutMin?: TokenAmount
    priceImpact?: Percent
    approveTo: string
    inTradeType?: SymbiosisTradeType
    outTradeType?: SymbiosisTradeType
    amountInUsd?: TokenAmount
    fee?: TokenAmount
} & SwapExactInTransactionPayload

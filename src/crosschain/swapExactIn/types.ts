import { TransactionRequest } from '@ethersproject/providers'
import { Percent, Token, TokenAmount } from '../../entities'
import { CrossChainSwapInfo as CrosschainSwapInfo } from '../baseSwapping'
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

export interface SwapExactInOnchain {
    kind: 'onchain-swap'
    route: Token[]
    tokenAmountOut: TokenAmount
    tokenAmountOutMin: TokenAmount
    priceImpact: Percent
    approveTo: string
    tradeType: SymbiosisTradeType
}

export interface SwapExactInWrap {
    kind: 'wrap'
    route: Token[]
    tokenAmountOut: TokenAmount
}

export interface SwapExactInUnwrap {
    kind: 'unwrap'
    route: Token[]
    tokenAmountOut: TokenAmount
}

export interface SwapExactInCrosschain extends CrosschainSwapInfo {
    kind: 'crosschain-swap'
}

export interface SwapExactInBridge {
    kind: 'bridge'
    fee: TokenAmount
    tokenAmountOut: TokenAmount
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

export type SwapExactInResult = (
    | SwapExactInOnchain
    | SwapExactInCrosschain
    | SwapExactInWrap
    | SwapExactInUnwrap
    | SwapExactInBridge
) &
    SwapExactInTransactionPayload

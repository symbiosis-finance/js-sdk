import { TransactionRequest } from '@ethersproject/providers'

import { ChainId, TokenConstructor } from '../constants'
import { Percent, Token, TokenAmount } from '../entities'
import { OneInchProtocols } from './trade/oneInchTrade'
import { SymbiosisKind, SymbiosisTradeType } from './trade'
import { TronTransactionData } from './chainUtils'
import { Symbiosis } from './symbiosis'
import { ProfilerItem } from '../entities/profiler'
import { SymbiosisTrade } from './trade/symbiosisTrade'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
}

export interface VolumeFeeCollector {
    chainId: ChainId
    address: string
    feeRate: string
    eligibleChains: ChainId[]
}

export type BridgeDirection = 'burn' | 'mint' | 'v2'

export type ChainConfig = {
    id: ChainId
    rpc: string
    spareRpcs?: string[]
    dexFee: number
    filterBlockOffset: number
    stables: TokenConstructor[]
    metaRouter: string
    metaRouterGateway: string
    multicallRouter: string
    router: string
    bridge: string
    synthesis: string
    portal: string
    fabric: string
    tonPortal?: string
}

export type AdvisorConfig = {
    url: string
}

export type OmniPoolConfig = {
    chainId: ChainId
    address: string
    oracle: string
    generalPurpose: boolean
}

export type SwapLimit = {
    chainId: ChainId
    address: string
    min: string
    max: string
}

export type Config = {
    advisor: AdvisorConfig
    omniPools: OmniPoolConfig[]
    revertableAddress: Partial<Record<ChainId, string>> & { default: string }
    limits: SwapLimit[]
    chains: ChainConfig[]
}

export type OverrideChainConfig = {
    id: ChainId
    rpc: string
}
export type FeeConfig = {
    token: Token
    value: string
}

export type SelectMode = 'fastest' | 'best_return'

export type OneInchConfig = {
    apiUrl: string
    apiKeys: string[]
}

export type OpenOceanConfig = {
    apiUrl: string
    apiKeys: string[]
}

export type OverrideConfig = {
    chains?: OverrideChainConfig[]
    limits?: SwapLimit[]
    fetch?: typeof fetch
    advisor?: AdvisorConfig
    oneInchConfig?: OneInchConfig
    openOceanConfig?: OpenOceanConfig
}

export interface MiddlewareCall {
    address: string
    data: string
    offset: number
}

export interface RevertableAddress {
    chainId: ChainId
    address: string
}

export type TradeAContext = 'metaRouter' | 'multicallRouter'

export interface SwapExactInParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
    slippage: number
    deadline: number
    transitTokenIn?: Token
    transitTokenOut?: Token
    oneInchProtocols?: OneInchProtocols
    middlewareCall?: MiddlewareCall
    revertableAddresses?: RevertableAddress[]
    selectMode?: SelectMode
    tradeAContext?: TradeAContext
    refundAddress?: string
}

export type BtcTransactionData = {
    depositAddress: string
    validUntil: string
    tokenAmountOut: TokenAmount
}

export type TonTransactionData = {
    validUntil: number
    messages: {
        address: string
        amount: string
        payload: string
    }[]
}

export type SolanaTransactionData = {
    instructions: string
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
    | {
          transactionType: 'btc'
          transactionRequest: BtcTransactionData
      }
    | {
          transactionType: 'ton'
          transactionRequest: TonTransactionData
      }
    | {
          transactionType: 'solana'
          transactionRequest: SolanaTransactionData
      }

export type RouteItem = {
    provider: SymbiosisTradeType
    tokens: Token[]
}

export type FeeItem = {
    provider: SymbiosisTradeType
    value: TokenAmount
    save?: TokenAmount
    description?: string
}

export type SwapExactInResult = {
    kind: SymbiosisKind
    tokenAmountOut: TokenAmount
    tokenAmountOutMin: TokenAmount
    priceImpact: Percent
    approveTo: string
    routes: RouteItem[]
    fees: FeeItem[]

    amountInUsd?: TokenAmount
    timeLog?: ProfilerItem[]
    routeType?: string
    poolAddress?: string
    tradeA?: SymbiosisTrade
    tradeC?: SymbiosisTrade
} & SwapExactInTransactionPayload

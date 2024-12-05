import { ChainId, TokenConstructor } from '../constants'
import { Percent, Token, TokenAmount } from '../entities'
import { OneInchProtocols } from './trade/oneInchTrade'
import { SymbiosisKind, SymbiosisTradeType } from './trade'
import { TransactionRequest } from '@ethersproject/providers'
import { TronTransactionData } from './chainUtils'
import { Symbiosis } from './symbiosis'
import { ProfilerItem } from '../entities/profiler'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
}

export interface ExtraFeeCollector {
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
    symBtc?: {
        address: string
        chainId: ChainId
    }
    forwarderUrl?: string
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
    chainExceptions?: ChainId[]
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
    apiKey: string
}

export type OpenOceanConfig = {
    apiUrl: string
    apiKey: string
}

export type OverrideConfig = {
    chains?: OverrideChainConfig[]
    limits?: SwapLimit[]
    fetch?: typeof fetch
    advisor?: AdvisorConfig
    oneInchConfig: OneInchConfig
    openOceanConfig: OpenOceanConfig
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
} & SwapExactInTransactionPayload

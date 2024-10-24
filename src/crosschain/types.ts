import { ChainId, TokenConstructor } from '../constants'
import { MakeOneInchRequestFn } from './oneInchRequest'
import { Percent, Token, TokenAmount } from '../entities'
import { OneInchProtocols } from './trade/oneInchTrade'
import { SymbiosisKind, SymbiosisTradeType } from './trade'
import { TransactionRequest } from '@ethersproject/providers'
import { TronTransactionData } from './chainUtils/tron'
import { Symbiosis } from './symbiosis'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
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
    transitFeeMap: Record<string, string>
}

export type OverrideChainConfig = {
    id: ChainId
    rpc: string
}
export type OverrideConfig = {
    chains?: OverrideChainConfig[]
    limits?: SwapLimit[]
    makeOneInchRequest?: MakeOneInchRequestFn
    fetch?: typeof fetch
    directRouteClients?: string[]
    advisor?: AdvisorConfig
    transitFeeMap?: Record<string, string>
}

export interface MiddlewareCall {
    address: string
    data: string
    offset: number
}

export interface SwapExactInParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
    transitTokenIn?: Token
    transitTokenOut?: Token
    middlewareCall?: MiddlewareCall
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
    timeLog?: (string | number)[][]
} & SwapExactInTransactionPayload

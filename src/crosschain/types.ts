import type { TransactionRequest } from '@ethersproject/providers'
import type { BigNumber, BytesLike } from 'ethers'

import type { ChainId } from '../constants'
import type { Percent, ProfilerItem, Token, TokenAmount, TokenConstructor } from '../entities'
import type { Cache } from './cache'
import type { TronTransactionData } from './chainUtils'
import type { ConfigCacheData } from './config/cache/builder'
import type { PartnerFeeCollector } from './contracts'
import type { Symbiosis } from './symbiosis'
import type { SwapLabel } from './labels'
import type { TradeProvider } from './trade'
import type { OneInchProtocols } from './trade/oneInchTrade'
import type { SymbiosisTrade } from './trade/symbiosisTrade'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
}

export type EvmAddress = `0x${string}`
export type TronAddress = `T${string}`
export type TonBounceableAddress = `E${string}`
export type TonNonbounceableAddress = `U${string}`
export type TonAddress = TonBounceableAddress | TonNonbounceableAddress
export type BtcAddress = `bc1${string}` | `1${string}` | `3${string}`
export type EmptyAddress = ''
export type NonEmptyAddress = EvmAddress | TronAddress | TonAddress | BtcAddress
export type Address = NonEmptyAddress | EmptyAddress

export interface VolumeFeeCollector {
    chainId: ChainId
    address: Address
    feeRate: string
    eligibleChains: ChainId[]
    default?: boolean
}

export type BridgeDirection = 'burn' | 'mint' | 'v2'

export type PriceEstimationConfig = {
    enabled: boolean
    slippageMax: number // Maximum slippage - used for tokenAmountOutMin calculation and delayed solving.
    slippageNorm: number // Normal slippage - used for tokenAmountOut calculation and immetiate solving.
}

// Addresses of Intent contracts (intent-based swap protocol)
export interface IntentConfig {
    depositorySrc: EvmAddress // Depository contract on the src chain
    depositoryDst: EvmAddress // Depository contract on the dst chain
    directUnlocker: EvmAddress // DirectUnlocker contract on the dst chain
    settlementUnlocker: EvmAddress // SettlementUnlocker contract on the src chain
}

// Addresses of Depository contracts
export interface DepositoryConfig {
    depository: EvmAddress
    withdrawUnlocker: EvmAddress
    branchedUnlocker: EvmAddress
    timedUnlocker: EvmAddress
    timedSwapUnlocker: EvmAddress
    btcRefundUnlocker?: EvmAddress
    priceEstimation: PriceEstimationConfig
    refundDelay?: number // Minimal delay before refund
    withdrawDelay: number // Minimal delay before withdraw
    minAmountDelay: number // Minimal delay before swap with minimal amount
}

export type ChainConfig = {
    id: ChainId
    rpc: string
    headers?: Record<string, string>
    spareRpcs?: string[]
    dexFee: number
    filterBlockOffset: number
    stables: TokenConstructor[]
    metaRouter: Address
    metaRouterGateway: Address
    multicallRouter: Address
    router: Address
    bridge: Address
    synthesis: Address
    portal: Address
    fabric: Address
    tonPortal?: string
    partnerFeeCollector?: string
    depository?: DepositoryConfig
    intentConfig?: IntentConfig
}

export type AdvisorConfig = {
    url: string
}

export type OmniPoolConfig = {
    chainId: ChainId
    address: Address
    oracle: string
    generalPurpose: boolean
    coinGeckoId:
        | 'usd-coin'
        | 'weth'
        | 'bitcoin'
        | 'g-token'
        | 'binancecoin'
        | 'symbiosis-finance'
        | 'apecoin'
        | 'evaa-protocol'
}

export type SwapLimit = {
    chainId: ChainId
    address: string
    min: string
    max: string
}

export type BtcConfig = {
    btc: Token
    symBtc: {
        address: EvmAddress
        chainId: ChainId
    }
    forwarderUrl: string
}

export type CoinGeckoConfig = {
    url: string
}

export type Config = {
    advisor: AdvisorConfig
    coinGecko?: CoinGeckoConfig
    omniPools: OmniPoolConfig[]
    revertableAddress: Partial<Record<ChainId, EvmAddress>> & { default: EvmAddress }
    limits: SwapLimit[]
    chains: ChainConfig[]
    fallbackReceiver: EvmAddress
    btcConfigs: BtcConfig[]
    solver?: {
        url: string // Solver service base URL (intent-based swaps)
    }
}

export type OverrideChainConfig = {
    id: ChainId
    rpc: string
    headers?: Record<string, string>
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

export type ChangellyConfig = {
    apiUrl: string
    privateKey: string
}

export type * from './config/cache/builder'

export type OverrideConfig = {
    btcConfigs?: BtcConfig[]
    chains?: OverrideChainConfig[]
    limits?: SwapLimit[]
    fetch?: typeof fetch
    advisor?: AdvisorConfig
    oneInchConfig?: Partial<OneInchConfig>
    openOceanConfig?: Partial<OpenOceanConfig>
    changellyConfig?: Partial<ChangellyConfig>
    volumeFeeCollectors?: VolumeFeeCollector[]
    cache?: Cache
    config?: Config
    configCache?: ConfigCacheData
}

export interface MiddlewareCall {
    address: Address
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
    tokenAmountInMin?: TokenAmount
    tokenOut: Token
    from: Address
    origin?: Address // in terms of 1inch it's a sender of the tx
    to: Address
    slippage: number
    deadline: number
    transitTokenIn?: Token
    transitTokenOut?: Token
    oneInchProtocols?: OneInchProtocols
    middlewareCall?: MiddlewareCall // Destination for funds instead of `to`. Deprecated.
    revertableAddresses?: RevertableAddress[]
    selectMode?: SelectMode
    tradeAContext?: TradeAContext
    partnerAddress?: EvmAddress
    refundAddress?: Address
    fallbackReceiver?: EvmAddress
    generateDepositAddress?: boolean
    disableSrcChainRouting?: boolean
    disableDstChainRouting?: boolean
    depositoryEnabled?: boolean
    disabledProviders?: TradeProvider[]
    changellyExtraIdTo?: string // destination tag (XRP) or memo (XLM) for payout address
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
        payload?: string
    }[]
}

export type SolanaTransactionData = {
    instructions: string
}

export type ChangellyTransactionData = {
    changellyTxId: string
    depositAddress: string
    depositExtraId?: string
    amountExpectedFrom: string
    amountExpectedTo: string
    networkFee: string
    validUntil: number
    currencyFrom: string
    currencyTo: string
    refundAddress?: string
    refundExtraId?: string
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
    | {
          transactionType: 'changelly'
          transactionRequest: ChangellyTransactionData
      }

export type RouteItem = {
    provider: TradeProvider
    tokens: Token[]
}

export type FeeItem = {
    provider: TradeProvider
    value: TokenAmount
    save?: TokenAmount
    description?: string
}

export type OperationType =
    | 'onchain-swap'
    | 'crosschain-swap'
    | 'wrap'
    | 'unwrap'
    | 'bridge'
    | 'from-btc-swap'
    | 'changelly-trade'
    | 'changelly-deposit'
    | 'intent-swap'

// Result of swapExactIn() method.
export type SwapExactInResult = SwapExactInTransactionPayload & {
    operationType: OperationType
    tokenAmountOut: TokenAmount
    tokenAmountOutMin: TokenAmount
    priceImpact: Percent
    approveTo: string
    routes: RouteItem[]
    fees: FeeItem[]
    labels: SwapLabel[]

    amountInUsd?: TokenAmount
    timeLog?: ProfilerItem[]
    routeType?: string
    poolAddress?: string
    tradeA?: SymbiosisTrade
    tradeC?: SymbiosisTrade
    changellyData?: ChangellyTransactionData
    permit2Approve?: { to: string; callData: string }
}

export interface MultiCallItem {
    to: string
    data: BytesLike
    offset: number
    value: string
    amountIn: TokenAmount // is used as approveToken as well
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    priceImpact: Percent
    fees: FeeItem[]
    routes: RouteItem[]
}

export type PartnerFeeCallParams = {
    partnerAddress: string
    partnerFeeCollector: PartnerFeeCollector
    feeRate: BigNumber
    fixedFee: BigNumber
}

export type MetricParams = {
    operation: string
    kind: string
    tokenIn?: Token
    tokenOut?: Token
}

export type CounterParams = {
    provider: string
    reason: string
    chain_id: string
}

export type PriceImpactMetricParams = {
    poolConfig: OmniPoolConfig
    tokenAmountFrom: TokenAmount
    tokenTo: Token
    priceImpact: Percent
}

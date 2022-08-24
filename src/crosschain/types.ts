import { ChainId, TokenConstructor } from '../constants'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
}

export enum PairState {
    LOADING,
    NOT_EXISTS,
    EXISTS,
    INVALID,
}

export type BridgeDirection = 'burn' | 'mint'

export type NerveConfig = {
    address: string
    tokens: string[]
    decimals: number[]
}

export interface ChainNearParams {
    networkId: string
    nodeUrl: string
    walletUrl: string
    helperUrl: string
}

export type ChainConfig = {
    id: ChainId
    rpc: string
    dexFee: number
    nonEvmParams?: ChainNearParams
    filterBlockOffset: number
    stables: TokenConstructor[]
    nerves: NerveConfig[]
    metaRouter: string
    metaRouterGateway: string
    multicallRouter: string
    aavePool: string
    creamComptroller: string
    renGatewayRegistry: string
    router: string
    bridge: string
    bridgeV2NonEvm?: string
    synthesis: string
    synthesisNonEvm?: string
    portal: string
    fabric: string
    syntFabricNonEvm?: string
    waitForBlocksCount: number
}

export type AdvisorConfig = {
    url: string
}

export type Config = {
    advisor: AdvisorConfig
    chains: ChainConfig[]
    minSwapAmountInUsd: number
    maxSwapAmountInUsd: number
}

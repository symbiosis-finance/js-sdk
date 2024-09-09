import { ChainId, TokenConstructor } from '../constants'
import { MakeOneInchRequestFn } from './oneInchRequest'

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

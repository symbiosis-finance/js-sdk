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
    symBtc?: string
    portal: string
    fabric: string
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

export type BtcConfig = {
    forwarderUrl: string
}
export type Config = {
    btc: BtcConfig
    advisor: AdvisorConfig
    omniPools: OmniPoolConfig[]
    revertableAddress: Partial<Record<ChainId, string>> & { default: string }
    limits?: SwapLimit[]
    chains: ChainConfig[]
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
}

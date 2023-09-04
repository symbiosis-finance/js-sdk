import { ChainId, TokenConstructor } from '../constants'

export enum Field {
    INPUT = 'INPUT',
    OUTPUT = 'OUTPUT',
}

export type BridgeDirection = 'burn' | 'mint' | 'v2'

export type ChainConfig = {
    id: ChainId
    rpc: string
    dexFee: number
    filterBlockOffset: number
    stables: TokenConstructor[]
    metaRouter: string
    metaRouterGateway: string
    multicallRouter: string
    aavePool: string
    aavePoolDataProvider: string
    creamComptroller: string
    creamCompoundLens: string
    renGatewayRegistry: string
    router: string
    bridge: string
    synthesis: string
    portal: string
    fabric: string
    waitForBlocksCount: number
    blocksPerYear: number
    revertableAddress: string
}

export type AdvisorConfig = {
    url: string
}

export type OmniPoolConfig = {
    chainId: ChainId
    address: string
    oracle: string
}

export type Config = {
    advisor: AdvisorConfig
    omniPools: OmniPoolConfig[]
    chains: ChainConfig[]
}

export type OverrideChainConfig = {
    id: ChainId
    rpc: string
}
export type OverrideConfig = {
    chains: OverrideChainConfig[]
}

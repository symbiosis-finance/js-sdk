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
    logsRpc?: string
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

export type AmountLimit = Record<string, string>

export type Config = {
    advisor: AdvisorConfig
    omniPools: OmniPoolConfig[]
    revertableAddress: Partial<Record<ChainId, string>> & { default: string }
    limits?: Partial<Record<ChainId, AmountLimit>>
    chains: ChainConfig[]
}

export type OverrideChainConfig = {
    id: ChainId
    rpc: string
}
export type OverrideConfig = {
    chains?: OverrideChainConfig[]
    limits?: Partial<Record<ChainId, AmountLimit>>
    makeOneInchRequest?: MakeOneInchRequestFn
    fetch?: typeof fetch
}

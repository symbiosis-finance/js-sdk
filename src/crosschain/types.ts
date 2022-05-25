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

export type ChainConfig = {
    id: ChainId
    rpc: string
    dexFee: number
    filterBlockOffset: number
    stables: TokenConstructor[]
    nerves: NerveConfig[]
    metaRouter: string
    multicallRouter: string
    aavePool: string
    router: string
    bridge: string
    synthesis: string
    portal: string
    fabric: string
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

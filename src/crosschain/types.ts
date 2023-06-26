import { ChainId, TokenConstructor } from '../constants'
import { BigNumber } from '@ethersproject/bignumber'

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

export type BridgeDirection = 'burn' | 'mint' | 'v2'

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
    metaRouterGateway: string
    multicallRouter: string
    aavePool: string
    creamComptroller: string
    renGatewayRegistry: string
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

export type OmniPoolConfig = {
    chainId: ChainId
    address: string
    oracle: string
}

export interface OmniPoolConfigWithTokens extends OmniPoolConfig {
    tokens: TokenConstructor[]
}

export type Config = {
    advisor: AdvisorConfig
    omniPool: OmniPoolConfig
    omniPools: OmniPoolConfigWithTokens[]
    chains: ChainConfig[]
    minSwapAmountInUsd: number
    maxSwapAmountInUsd: number
}

export type PoolAsset = {
    cash: BigNumber
    liability: BigNumber
    maxSupply: BigNumber
    totalSupply: BigNumber
    decimals: number
    token: string
    active: boolean
}

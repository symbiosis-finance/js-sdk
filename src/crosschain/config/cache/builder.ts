import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ChainId, TokenConstructor } from '../../../constants'
import { getMulticall } from '../../multicall'

import { ChainConfig, Config, OmniPoolConfig } from '../../types'
import {
    Fabric,
    Fabric__factory,
    OmniPool,
    OmniPool__factory,
    Portal,
    Portal__factory,
    Synthesis,
    Synthesis__factory,
} from '../../contracts'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Error } from '../../error'
import { Token } from '../../../entities'
import { config as mainnet } from '../mainnet'
import { config as testnet } from '../testnet'
import { config as dev } from '../dev'
import type { ConfigName } from '../../symbiosis'
import { BigNumberish } from 'ethers'
import { BigNumber } from '@ethersproject/bignumber'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs')

export type Id = number

export type TokenInfo = TokenConstructor & {
    id: Id
    pair?: Id
}

export type OmniPoolToken = {
    index: number
    tokenId: Id
}

export type OmniPoolInfo = OmniPoolConfig & {
    id: Id
    tokens: OmniPoolToken[]
}

export type TokenThreshold = {
    tokenId: Id
    type: string
    value: BigNumberish
}

export type ConfigCacheData = {
    tokens: TokenInfo[]
    omniPools: OmniPoolInfo[]
    thresholds: TokenThreshold[]
}

export class Builder {
    public readonly config: Config
    private providers: Map<ChainId, StaticJsonRpcProvider>

    public constructor(private readonly configName: ConfigName) {
        if (configName === 'mainnet') {
            this.config = mainnet
        } else if (configName === 'testnet') {
            this.config = testnet
        } else if (configName === 'dev') {
            this.config = dev
        } else {
            throw new Error('Unknown config name')
        }

        this.providers = new Map(
            this.config.chains.map((i) => {
                return [i.id, new StaticJsonRpcProvider(i.rpc, i.id)]
            })
        )
    }

    public async build() {
        const tokens = await this.buildTokensList()
        const omniPools = await this.buildOmniPools(tokens)
        const thresholds = await this.buildThresholds(tokens)

        const jsonData = JSON.stringify({
            omniPools,
            tokens,
            thresholds,
        } as ConfigCacheData)
        fs.writeFile(`./src/crosschain/config/cache/${this.configName}.json`, jsonData, function (err: any) {
            if (err) {
                console.log(err)
            }
        })
    }

    // === private ===
    private async getThresholds(
        tokens: TokenInfo[],
        contract: Portal | Synthesis,
        type: 'Portal' | 'Synthesis',
        chain: ChainConfig
    ): Promise<TokenThreshold[]> {
        const multicall = await getMulticall(this.getProvider(chain.id))
        const chainTokens = tokens.filter((token) => token.chainId === chain.id)
        const calls = chainTokens.map((token) => ({
            target: contract.address,
            callData: contract.interface.encodeFunctionData('tokenThreshold', [token.address]),
        }))
        const thresholdsResponse = await multicall.callStatic.tryAggregate(false, calls)
        return thresholdsResponse
            .map(([success, returnData], index) => {
                if (!success) {
                    throw new Error(`Cannot get token threshold from portal on chain ${chain.id}`)
                }

                const threshold = contract.interface.decodeFunctionResult('tokenThreshold', returnData)[0] as BigNumber
                return {
                    tokenId: chainTokens[index].id,
                    type,
                    value: threshold.toString(),
                } as TokenThreshold
            })
            .filter((i) => !!i)
    }
    private async buildThresholds(tokens: TokenInfo[]): Promise<TokenThreshold[]> {
        const chains = this.config.chains
        let thresholds: TokenThreshold[] = []

        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i]
            console.log(`Get thresholds from chain ${chain.id}`)

            if (chain.portal !== AddressZero) {
                const portal = this.portal(chain.id)
                const portalThresholds = await this.getThresholds(tokens, portal, 'Portal', chain)
                thresholds = [...thresholds, ...portalThresholds]
            }

            if (chain.synthesis !== AddressZero) {
                const synthesis = this.synthesis(chain.id)
                const synthesisThresholds = await this.getThresholds(tokens, synthesis, 'Synthesis', chain)
                thresholds = [...thresholds, ...synthesisThresholds]
            }
        }

        return thresholds
    }

    private async buildOmniPools(tokens: TokenInfo[]): Promise<OmniPoolInfo[]> {
        const info: OmniPoolInfo[] = []

        for (let i = 0; i < this.config.omniPools.length; i++) {
            const currentOctoPool = this.config.omniPools[i]
            console.log({ octoPool: i })
            const omniPool = this.omniPool(currentOctoPool)
            const multicall = await getMulticall(omniPool.provider)
            const last = (await omniPool.lastIndex()).toNumber()

            const indexes = [...Array(last).keys()].map((index: number) => ({
                target: omniPool.address,
                callData: omniPool.interface.encodeFunctionData('indexToAsset', [index]),
            }))
            const assets = await multicall.callStatic.tryAggregate(false, indexes)
            const poolTokens: OmniPoolToken[] = assets
                .map(([success, returnData], index) => {
                    if (!success) {
                        throw new Error(`Cannot get asset by index ${index}`)
                    }

                    const asset = omniPool.interface.decodeFunctionResult('indexToAsset', returnData)
                    if (!asset.active) {
                        console.log(`!active. skip index ${index}`)
                        return
                    }

                    const token = tokens.find(
                        (t) =>
                            t.address.toLowerCase() === asset.token.toLowerCase() &&
                            t.chainId === currentOctoPool.chainId
                    )
                    if (!token) {
                        console.log(`token ${asset.token} doesn't exist. skip index ${index}`)
                        return
                    }
                    return {
                        index: index,
                        tokenId: token.id,
                    }
                })
                .filter((i) => !!i) as OmniPoolToken[]

            info.push({
                ...currentOctoPool,
                id: i,
                tokens: poolTokens,
            })
        }

        return info
    }

    private async buildTokensList() {
        const chainsWithFabric = this.config.chains.filter((chain) => chain.fabric !== AddressZero)
        const stables = this.stables()

        const realTokensWithId: TokenInfo[] = []

        let idCounter = 0

        for (idCounter; idCounter < stables.length; idCounter++) {
            realTokensWithId.push({ ...stables[idCounter], id: idCounter })
        }
        const tokens: TokenInfo[] = realTokensWithId

        for (let i = 0; i < chainsWithFabric.length; i++) {
            const chainWithFabric = chainsWithFabric[i]
            console.log(`Get fabric in chain ${chainWithFabric.id}`)

            const fabric = this.fabric(chainWithFabric.id)

            const multicall = await getMulticall(fabric.provider)

            const synthTokens = realTokensWithId.map((token) => ({
                target: fabric.address,
                callData: fabric.interface.encodeFunctionData('getSyntRepresentation', [token.address, token.chainId]),
            }))

            const representationsResults = await multicall.callStatic.tryAggregate(false, synthTokens)
            representationsResults.forEach(([success, returnData], index) => {
                if (!success) {
                    throw new Error(`Cannot get representations from fabric on chain ${chainWithFabric.id}`)
                }

                const synthAddress = fabric.interface.decodeFunctionResult('getSyntRepresentation', returnData)[0]

                if (synthAddress === AddressZero) {
                    return
                }

                const token: TokenInfo = {
                    ...realTokensWithId[index],
                    id: idCounter++,
                    symbol: `s${realTokensWithId[index].symbol}`,
                    address: synthAddress,
                    chainId: chainWithFabric.id,
                    chainFromId: realTokensWithId[index].chainId,
                    pair: realTokensWithId[index].id,
                }
                realTokensWithId[index].pair = token.id

                tokens.push(token)
            })
        }

        return tokens
    }

    // === utility ===

    private chainConfig(chainId: ChainId): ChainConfig {
        const config = this.config.chains.find((item) => {
            return item.id === chainId
        })
        if (!config) throw new Error(`Could not config by given chainId: ${chainId}`)
        return config
    }

    private getProvider(chainId: ChainId): StaticJsonRpcProvider {
        const provider = this.providers.get(chainId)
        if (!provider) {
            throw new Error('No provider for given chainId')
        }
        return provider
    }

    private stables(): Token[] {
        return this.config.chains
            .map((chainConfig) => {
                return chainConfig.stables.map((params) => {
                    return new Token(params)
                })
            })
            .reduce((acc, tokens) => {
                return [...acc, ...tokens]
            }, [])
    }

    private fabric(chainId: ChainId): Fabric {
        const address = this.chainConfig(chainId).fabric

        return Fabric__factory.connect(address, this.getProvider(chainId))
    }

    private synthesis(chainId: ChainId): Synthesis {
        const address = this.chainConfig(chainId).synthesis

        return Synthesis__factory.connect(address, this.getProvider(chainId))
    }

    private portal(chainId: ChainId): Portal {
        const address = this.chainConfig(chainId).portal

        return Portal__factory.connect(address, this.getProvider(chainId))
    }

    public omniPool(config: OmniPoolConfig): OmniPool {
        const { address, chainId } = config

        return OmniPool__factory.connect(address, this.getProvider(chainId))
    }
}

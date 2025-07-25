import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { ChainId, TokenConstructor } from '../../../constants'
import { getMulticall } from '../../multicall'

import { ChainConfig, Config, OmniPoolConfig } from '../../types'
import {
    Bridge,
    Bridge__factory,
    Fabric,
    Fabric__factory,
    MetaRouter,
    MetaRouter__factory,
    OmniPool,
    OmniPool__factory,
    Portal,
    Portal__factory,
    Synthesis,
    Synthesis__factory,
} from '../../contracts'
import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Token } from '../../../entities'
import { config as mainnet } from '../mainnet'
import { config as testnet } from '../testnet'
import { config as dev } from '../dev'
import type { ConfigName } from '../../symbiosis'
import { Contract } from '@ethersproject/contracts'
import ERC20 from '../../abis/ERC20.json'
import { isBtcChainId, isSolanaChainId, isTonChainId, isTronChainId } from '../../chainUtils'
import fs from 'fs'

export type Id = number

export type TokenInfo = TokenConstructor & {
    id: Id
    originalId?: Id
}

export type OmniPoolToken = {
    index: number
    tokenId: Id
}

export type OmniPoolInfo = OmniPoolConfig & {
    id: Id
    tokens: OmniPoolToken[]
}

export type ConfigCacheData = {
    tokens: TokenInfo[]
    omniPools: OmniPoolInfo[]
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
            this.config.chains.map((chainConfig) => {
                const rpc = isTronChainId(chainConfig.id) ? `${chainConfig.rpc}/jsonrpc` : chainConfig.rpc

                return [chainConfig.id, new StaticJsonRpcProvider(rpc, chainConfig.id)]
            })
        )
    }

    public async build() {
        try {
            await this.checkPortalTokensWhitelisted()
            await this.checkTransmitters()
            await this.checkMetarouters()
            const tokens = await this.buildTokensList()
            const omniPools = await this.buildOmniPools(tokens)

            const jsonData = JSON.stringify({
                omniPools,
                tokens,
            } as ConfigCacheData)
            fs.writeFile(`./src/crosschain/config/cache/${this.configName}.json`, jsonData, function (err) {
                if (err) {
                    console.error(err)
                }
            })
        } catch (e) {
            console.error(e)
        }
    }

    // === private ===

    private async checkTransmitters() {
        console.log('checkTransmitters')
        const chains = this.config.chains
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i]
            const bridge = this.bridge(chain.id)

            if (isTonChainId(chain.id) || isSolanaChainId(chain.id)) {
                continue
            }

            if (chain.portal !== AddressZero) {
                const ok = await bridge.isTransmitter(chain.portal)
                if (!ok) {
                    throw new Error(`${chain.id} Portal is not transmitter`)
                }
            }
            if (chain.synthesis !== AddressZero) {
                const ok = await bridge.isTransmitter(chain.synthesis)
                if (!ok) {
                    throw new Error(`${chain.id} Synthesis is not transmitter`)
                }
            }
        }
    }

    private async checkPortalTokensWhitelisted() {
        console.log('checkPortalTokensWhitelisted')
        const chains = this.config.chains
        const promises = []
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i]

            if (isTonChainId(chain.id) || isSolanaChainId(chain.id)) {
                continue
            }
            const portal = this.portal(chain.id)
            if (portal.address !== AddressZero) {
                for (let j = 0; j < chain.stables.length; j++) {
                    const token = chain.stables[j]

                    // syBTC on BNB chain
                    if (token.address === '0xA67c48F86Fc6d0176Dca38883CA8153C76a532c7') {
                        continue
                    }
                    // syBTC on RSK chain
                    if (token.address === '0xB52E582263c1d0189b3cc1402c1B7205b7F2E9Ba') {
                        continue
                    }

                    // FIXME remove skipping GPTW on BSC chain if whitelisted on portal
                    if (token.address.toLowerCase() === '0xB3F4D70C6a18cC0F2D1205dbF3B21cB73e1B0592'.toLowerCase()) {
                        continue
                    }

                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const promise = new Promise((resolve, _reject) => {
                        ;(async () => {
                            resolve({
                                chainId: chain.id,
                                token: token.address,
                                ok: await portal.tokenWhitelist(token.address),
                            })
                        })()
                    })
                    promises.push(promise)
                }
            }
        }
        const results = (await Promise.all(promises)) as { chainId: ChainId; token: string; ok: boolean }[]
        results.forEach((result) => {
            if (!result.ok) {
                const errorMessage = `${result.chainId} Token ${result.token} is not whitelisted on portal`
                // console.error(errorMessage)
                throw new Error(errorMessage)
            }
        })
    }

    private async checkMetarouters() {
        console.log('checkMetarouters')
        const chains = this.config.chains

        let error = false
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i]
            const metaRouterAddressFromConfig = chain.metaRouter.toLowerCase()

            if (isBtcChainId(chain.id) || isTonChainId(chain.id) || isSolanaChainId(chain.id)) {
                continue
            }

            const portal = this.portal(chain.id)
            let portalMetaRouter
            if (portal.address !== AddressZero) {
                portalMetaRouter = (await portal.callStatic.metaRouter()).toLowerCase()
            }

            const synthesis = this.synthesis(chain.id)
            let synthesisMetaRouter
            // NOTE because there is separate metarouter for btc integration
            if (
                synthesis.address !== AddressZero &&
                chain.id !== ChainId.ARBITRUM_MAINNET &&
                chain.id !== ChainId.ZKSYNC_MAINNET &&
                chain.id !== ChainId.BSC_MAINNET
            ) {
                synthesisMetaRouter = (await synthesis.callStatic.metaRouter()).toLowerCase()
            }

            if (
                (portalMetaRouter && metaRouterAddressFromConfig !== portalMetaRouter) ||
                (synthesisMetaRouter && metaRouterAddressFromConfig !== synthesisMetaRouter)
            ) {
                console.log(chain.id, {
                    metaRouterAddressFromConfig,
                    portalMetaRouter,
                    synthesisMetaRouter,
                })
                error = true
            }

            const metaRouterGatewayAddressFromConfig = chain.metaRouterGateway.toLowerCase()
            const metaRouter = this.metaRouter(chain.id)
            const metaRouterGatewayAddressFromContract = (await metaRouter.callStatic.metaRouterGateway()).toLowerCase()

            if (metaRouterGatewayAddressFromConfig !== metaRouterGatewayAddressFromContract) {
                console.log(chain.id, {
                    metaRouterGatewayAddressFromConfig,
                    metaRouterGatewayAddressFromContract,
                })
                error = true
            }
        }

        if (error) {
            throw new Error('There are differences')
        }
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
        const stables = this.stables()
        const realTokensWithId: TokenInfo[] = []
        let idCounter = 0

        // --- add id for each stable(swapable) coin as index ---
        for (idCounter; idCounter < stables.length; idCounter++) {
            realTokensWithId.push({ ...stables[idCounter], id: idCounter })
        }

        this.config.btcConfigs.forEach((btcConfig) => {
            realTokensWithId.push({ ...btcConfig.btc, id: idCounter++ })
        })

        const tokens: TokenInfo[] = realTokensWithId

        const chainsWithFabric = this.config.chains.filter((chain) => chain.fabric !== AddressZero)

        // --- On this network exists synthetic tokens ---
        for (let i = 0; i < chainsWithFabric.length; i++) {
            const chainWithFabric = chainsWithFabric[i]
            console.log(`Get fabric in chain ${chainWithFabric.id}`)

            const fabric = this.fabric(chainWithFabric.id)

            const multicall = await getMulticall(fabric.provider)

            const synthCalls = realTokensWithId.map((token) => ({
                target: fabric.address,
                callData: fabric.interface.encodeFunctionData('getSyntRepresentation', [token.address, token.chainId]),
            }))

            const synthResults = await multicall.callStatic.tryAggregate(false, synthCalls)
            const synthTokenAddresses = synthResults.map(([success, returnData]) => {
                if (!success) {
                    throw new Error(`Cannot get representations from fabric on chain ${chainWithFabric.id}`)
                }

                const synthAddress = fabric.interface.decodeFunctionResult('getSyntRepresentation', returnData)[0]

                if (synthAddress === AddressZero) {
                    return
                }
                return synthAddress
            })

            for (let j = 0; j < synthTokenAddresses.length; j++) {
                const address = synthTokenAddresses[j]
                if (!address) {
                    continue
                }

                const erc20 = new Contract(address, ERC20, fabric.provider)

                const token: TokenInfo = {
                    ...realTokensWithId[j],
                    isNative: false,
                    id: idCounter++,
                    symbol: await erc20.symbol(),
                    name: await erc20.name(),
                    address: address,
                    chainId: chainWithFabric.id,
                    chainFromId: realTokensWithId[j].chainId,
                    originalId: realTokensWithId[j].id,
                }

                tokens.push(token)
            }
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
            throw new Error(`No provider for given chainId: ${chainId}`)
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

    private bridge(chainId: ChainId): Bridge {
        const address = this.chainConfig(chainId).bridge

        return Bridge__factory.connect(address, this.getProvider(chainId))
    }

    private metaRouter(chainId: ChainId): MetaRouter {
        const address = this.chainConfig(chainId).metaRouter

        return MetaRouter__factory.connect(address, this.getProvider(chainId))
    }

    public omniPool(config: OmniPoolConfig): OmniPool {
        const { address, chainId } = config

        return OmniPool__factory.connect(address, this.getProvider(chainId))
    }
}

import { StaticJsonRpcProvider, Log } from '@ethersproject/providers'
import { BigNumber, Signer, utils } from 'ethers'
import isomorphicFetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import TronWeb, { TransactionInfo } from 'tronweb'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount, wrappedToken } from '../entities'
import { Bridging } from './bridging'
import { ONE_INCH_ORACLE_MAP } from './constants'
import {
    Aave,
    Aave__factory,
    AdaRouter,
    AdaRouter__factory,
    AvaxRouter,
    AvaxRouter__factory,
    BeefyVault,
    BeefyVault__factory,
    BenqiQiErc20,
    BenqiQiErc20__factory,
    Bridge,
    Bridge__factory,
    CreamCErc20,
    CreamCErc20__factory,
    CreamComptroller,
    CreamComptroller__factory,
    Fabric,
    Fabric__factory,
    KavaRouter,
    KavaRouter__factory,
    KimRouter,
    KimRouter__factory,
    MetaRouter,
    MetaRouter__factory,
    MulticallRouter,
    MulticallRouter__factory,
    OmniPool,
    OmniPool__factory,
    OmniPoolOracle,
    OmniPoolOracle__factory,
    OneInchOracle,
    OneInchOracle__factory,
    Portal,
    Portal__factory,
    SyncSwapLaunchPool,
    SyncSwapLaunchPool__factory,
    Synthesis,
    Synthesis__factory,
    UniLikeRouter,
    UniLikeRouter__factory,
} from './contracts'
import { Error, ErrorCode } from './error'
import { RevertPending } from './revert'
import { statelessWaitForComplete } from './statelessWaitForComplete'
import { Swapping } from './swapping'
import { getTransactionInfoById, isTronChainId } from './tron'
import { ChainConfig, Config, OmniPoolConfig, OverrideConfig } from './types'
import { Zapping } from './zapping'
import { ZappingAave } from './zappingAave'
import { ZappingBeefy } from './zappingBeefy'
import { ZappingCream } from './zappingCream'
import { config as mainnet } from './config/mainnet'
import { config as testnet } from './config/testnet'
import { config as dev } from './config/dev'
import { config as teleport } from './config/teleport'
import { BestPoolSwapping } from './bestPoolSwapping'
import { ConfigCache } from './config/cache/cache'
import { OmniPoolInfo } from './config/cache/builder'
import { PendingRequest } from './revertRequest'
import { MakeOneInchRequestFn, makeOneInchRequestFactory } from './oneInchRequest'
import { SwapExactInParams, swapExactIn, SwapExactInResult } from './swapExactIn'
import { ZappingThor } from './zappingThor'
import { delay } from '../utils'

export type ConfigName = 'dev' | 'testnet' | 'mainnet' | 'teleport'

export type DiscountTier = {
    amount: string
    discount: number
}

const defaultFetch: typeof fetch = (url, init) => {
    return isomorphicFetch(url as string, init)
}

export class Symbiosis {
    public providers: Map<ChainId, StaticJsonRpcProvider>

    public readonly config: Config
    public readonly clientId: string

    private readonly configCache: ConfigCache

    private signature: string | undefined

    public readonly makeOneInchRequest: MakeOneInchRequestFn

    public readonly fetch: typeof fetch

    public setSignature(signature: string) {
        this.signature = signature
    }

    public async getDiscountTiers(): Promise<DiscountTier[]> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount-tiers`)

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(json.message ?? text)
        }

        return await response.json()
    }

    public async getDiscount(signature: string): Promise<number> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                signature,
            }),
        })

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(json.message ?? text)
        }

        const json = await response.json()

        return json['percent'] as number
    }

    public constructor(config: ConfigName, clientId: string, overrideConfig?: OverrideConfig) {
        if (config === 'mainnet') {
            this.config = mainnet
        } else if (config === 'testnet') {
            this.config = testnet
        } else if (config === 'dev') {
            this.config = dev
        } else if (config === 'teleport') {
            this.config = teleport
        } else {
            throw new Error('Unknown config name')
        }

        if (overrideConfig?.chains) {
            const { chains } = overrideConfig
            this.config.chains = this.config.chains.map((chainConfig) => {
                const found = chains.find((i) => i.id === chainConfig.id)
                if (found) {
                    chainConfig.rpc = found.rpc
                }
                return chainConfig
            })
        }
        this.fetch = overrideConfig?.fetch ?? defaultFetch

        this.makeOneInchRequest = overrideConfig?.makeOneInchRequest ?? makeOneInchRequestFactory(this.fetch)

        this.configCache = new ConfigCache(config)

        this.clientId = utils.formatBytes32String(clientId)

        this.providers = new Map(
            this.config.chains.map((chain) => {
                const rpc = isTronChainId(chain.id) ? `${chain.rpc}/jsonrpc` : chain.rpc
                return [chain.id, new StaticJsonRpcProvider(rpc, chain.id)]
            })
        )
    }

    public validateSwapAmounts(amount: TokenAmount): void {
        const { token } = amount
        const wrapped = wrappedToken(token)
        const threshold = this.configCache.getTokenThreshold(wrapped)
        if (BigNumber.from(amount.raw.toString()).lt(threshold)) {
            const formattedThreshold = utils.formatUnits(threshold, token.decimals)

            throw new Error(
                `The amount is too low: ${amount.toFixed(2)}. Min amount: ${formattedThreshold}`,
                ErrorCode.AMOUNT_TOO_LOW
            )
        }
    }

    public chains(): Chain[] {
        const ids = this.config.chains.map((i) => i.id)
        return chains.filter((i) => ids.includes(i.id))
    }

    public swapExactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return swapExactIn({ symbiosis: this, ...params })
    }

    public newBridging() {
        return new Bridging(this)
    }

    public newSwapping(omniPoolConfig: OmniPoolConfig) {
        return new Swapping(this, omniPoolConfig)
    }

    public bestPoolSwapping() {
        return new BestPoolSwapping(this)
    }

    public newRevertPending(request: PendingRequest) {
        return new RevertPending(this, request)
    }

    public newZapping(omniPoolConfig: OmniPoolConfig) {
        return new Zapping(this, omniPoolConfig)
    }

    public newZappingAave(omniPoolConfig: OmniPoolConfig) {
        return new ZappingAave(this, omniPoolConfig)
    }

    public newZappingThor(omniPoolConfig: OmniPoolConfig) {
        return new ZappingThor(this, omniPoolConfig)
    }

    public newZappingCream(omniPoolConfig: OmniPoolConfig) {
        return new ZappingCream(this, omniPoolConfig)
    }

    public newZappingBeefy(omniPoolConfig: OmniPoolConfig) {
        return new ZappingBeefy(this, omniPoolConfig)
    }

    public getProvider(chainId: ChainId): StaticJsonRpcProvider {
        const provider = this.providers.get(chainId)
        if (!provider) {
            throw new Error('No provider for given chainId')
        }
        return provider
    }

    public portal(chainId: ChainId, signer?: Signer): Portal {
        const address = this.chainConfig(chainId).portal
        const signerOrProvider = signer || this.getProvider(chainId)

        return Portal__factory.connect(address, signerOrProvider)
    }

    public synthesis(chainId: ChainId, signer?: Signer): Synthesis {
        const address = this.chainConfig(chainId).synthesis
        const signerOrProvider = signer || this.getProvider(chainId)

        return Synthesis__factory.connect(address, signerOrProvider)
    }

    public bridge(chainId: ChainId, signer?: Signer): Bridge {
        const address = this.chainConfig(chainId).bridge
        const signerOrProvider = signer || this.getProvider(chainId)

        return Bridge__factory.connect(address, signerOrProvider)
    }

    public fabric(chainId: ChainId, signer?: Signer): Fabric {
        const address = this.chainConfig(chainId).fabric
        const signerOrProvider = signer || this.getProvider(chainId)

        return Fabric__factory.connect(address, signerOrProvider)
    }

    public uniLikeRouter(chainId: ChainId, signer?: Signer): UniLikeRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return UniLikeRouter__factory.connect(address, signerOrProvider)
    }

    public avaxRouter(chainId: ChainId, signer?: Signer): AvaxRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return AvaxRouter__factory.connect(address, signerOrProvider)
    }

    public adaRouter(chainId: ChainId, signer?: Signer): AdaRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return AdaRouter__factory.connect(address, signerOrProvider)
    }

    public kavaRouter(chainId: ChainId, signer?: Signer): KavaRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return KavaRouter__factory.connect(address, signerOrProvider)
    }
    public kimRouter(chainId: ChainId, signer?: Signer): KimRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return KimRouter__factory.connect(address, signerOrProvider)
    }

    public creamCErc20ByAddress(address: string, chainId: ChainId, signer?: Signer): CreamCErc20 {
        const signerOrProvider = signer || this.getProvider(chainId)

        return CreamCErc20__factory.connect(address, signerOrProvider)
    }

    public benqiQiErc20ByAddress(address: string, chainId: ChainId, signer?: Signer): BenqiQiErc20 {
        const signerOrProvider = signer || this.getProvider(chainId)

        return BenqiQiErc20__factory.connect(address, signerOrProvider)
    }

    public creamComptroller(chainId: ChainId, signer?: Signer): CreamComptroller {
        const address = this.chainConfig(chainId).creamComptroller
        const signerOrProvider = signer || this.getProvider(chainId)

        return CreamComptroller__factory.connect(address, signerOrProvider)
    }

    public aavePool(chainId: ChainId, signer?: Signer): Aave {
        const address = this.chainConfig(chainId).aavePool
        const signerOrProvider = signer || this.getProvider(chainId)

        return Aave__factory.connect(address, signerOrProvider)
    }

    public multicallRouter(chainId: ChainId, signer?: Signer): MulticallRouter {
        const address = this.chainConfig(chainId).multicallRouter
        const signerOrProvider = signer || this.getProvider(chainId)

        return MulticallRouter__factory.connect(address, signerOrProvider)
    }

    public metaRouter(chainId: ChainId, signer?: Signer): MetaRouter {
        const address = this.chainConfig(chainId).metaRouter
        const signerOrProvider = signer || this.getProvider(chainId)

        return MetaRouter__factory.connect(address, signerOrProvider)
    }

    public omniPool(config: OmniPoolConfig, signer?: Signer): OmniPool {
        const { address, chainId } = config
        const signerOrProvider = signer || this.getProvider(chainId)

        return OmniPool__factory.connect(address, signerOrProvider)
    }

    public omniPoolOracle(config: OmniPoolConfig, signer?: Signer): OmniPoolOracle {
        const { oracle, chainId } = config
        const signerOrProvider = signer || this.getProvider(chainId)

        return OmniPoolOracle__factory.connect(oracle, signerOrProvider)
    }

    public oneInchOracle(chainId: ChainId, signer?: Signer): OneInchOracle {
        const address = ONE_INCH_ORACLE_MAP[chainId]
        if (!address) {
            throw new Error(`Could not find oneInch off-chain oracle on chain ${chainId}`)
        }
        const signerOrProvider = signer || this.getProvider(chainId)

        return OneInchOracle__factory.connect(address, signerOrProvider)
    }

    public beefyVault(address: string, chainId: ChainId, signer?: Signer): BeefyVault {
        const signerOrProvider = signer || this.getProvider(chainId)

        return BeefyVault__factory.connect(address, signerOrProvider)
    }

    public syncSwapLaunchPool(address: string, chainId: ChainId, signer?: Signer): SyncSwapLaunchPool {
        const signerOrProvider = signer || this.getProvider(chainId)

        return SyncSwapLaunchPool__factory.connect(address, signerOrProvider)
    }

    public getRepresentation(token: Token, chainId: ChainId): Token | undefined {
        return this.configCache.getRepresentation(token, chainId)
    }

    public getOmniPoolTokenIndex(omniPoolConfig: OmniPoolConfig, token: Token): number {
        return this.configCache.getOmniPoolTokenIndex(omniPoolConfig, token)
    }

    public async getBridgeFee({
        calldata,
        receiveSide,
        chainIdFrom,
        chainIdTo,
    }: {
        calldata: string
        receiveSide: string
        chainIdFrom: ChainId
        chainIdTo: ChainId
    }): Promise<{ price: JSBI; save: JSBI }> {
        const params = {
            chain_id_from: chainIdFrom,
            chain_id_to: chainIdTo,
            receive_side: receiveSide,
            call_data: calldata,
            client_id: utils.parseBytes32String(this.clientId),
            signature: this.signature,
        }

        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        })

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(json.message ?? text)
        }

        const { price, save } = await response.json()

        return {
            price: JSBI.BigInt(price),
            save: JSBI.BigInt(save),
        }
    }

    public filterBlockOffset(chainId: ChainId): number {
        return this.chainConfig(chainId).filterBlockOffset
    }

    public async getFromBlockWithOffset(chainId: ChainId): Promise<number> {
        const provider = this.getProvider(chainId)

        const blockNumber = await provider.getBlockNumber()

        const offset = this.filterBlockOffset(chainId)

        return Math.max(0, blockNumber - offset)
    }

    public dexFee(chainId: ChainId): number {
        return this.chainConfig(chainId).dexFee
    }

    public chainConfig(chainId: ChainId): ChainConfig {
        const config = this.config.chains.find((item) => {
            return item.id === chainId
        })
        if (!config) throw new Error(`Could not config by given chainId: ${chainId}`)
        return config
    }

    // === stables ===

    public tokens(): Token[] {
        return this.configCache.tokens()
    }

    public findToken(address: string, chainId: ChainId, chainFromId?: ChainId): Token | undefined {
        return this.tokens().find((token) => {
            const condition = token.address.toLowerCase() === address.toLowerCase() && token.chainId === chainId

            if (chainFromId === undefined) return condition

            return condition && token.chainFromId === chainFromId
        })
    }

    public transitToken(chainId: ChainId, omniPoolConfig: OmniPoolConfig): Token {
        const tokens = this.configCache.tokens().filter((token) => {
            return token.chainId === chainId
        })
        if (tokens.length === 0) {
            throw new Error(`Cannot find token for chain ${chainId}`)
        }
        const omniPool = this.configCache.getOmniPoolByConfig(omniPoolConfig)
        if (!omniPool) {
            throw new Error(`Cannot find omniPool ${omniPool}`)
        }

        // if token is from manager chain (token's chainIs equals to pool chainId)
        if (chainId === omniPoolConfig.chainId) {
            return tokens[0]
        }

        // find the FIRST suitable token from the tokens list
        // e.g. the first token has priority
        const transitToken = tokens.find((token) => {
            return this.getOmniPoolByToken(token)?.id === omniPool.id
        })

        if (!transitToken) {
            throw new Error(
                `Cannot find transitToken for chain ${chainId}. Pool: ${omniPool.id}`,
                ErrorCode.NO_TRANSIT_TOKEN
            )
        }
        return transitToken
    }

    public getOmniPoolByConfig(config: OmniPoolConfig): OmniPoolInfo | undefined {
        return this.configCache.getOmniPoolByConfig(config)
    }

    public getOmniPoolByToken(token: Token): OmniPoolInfo | undefined {
        return this.configCache.getOmniPoolByToken(token)
    }

    public getOmniPoolTokens(omniPoolConfig: OmniPoolConfig): Token[] {
        return this.configCache.getOmniPoolTokens(omniPoolConfig)
    }

    public tronWeb(chainId: ChainId): TronWeb {
        if (!isTronChainId(chainId)) {
            throw new Error(`Chain ${chainId} is not Tron chain`)
        }

        const config = this.chainConfig(chainId)
        if (!config) {
            throw new Error(`Could not find Tron config for chain ${chainId}`)
        }

        return new TronWeb({ fullHost: config.rpc, eventNode: config.rpc, solidityNode: config.rpc })
    }

    public async waitForComplete(chainId: ChainId, txId: string): Promise<string> {
        return statelessWaitForComplete(this, chainId, txId)
    }

    public async findTransitTokenSent(chainId: ChainId, transactionHash: string): Promise<TokenAmount | undefined> {
        const metarouter = this.metaRouter(chainId)
        const providerTo = this.getProvider(chainId)

        const receipt = await providerTo.getTransactionReceipt(transactionHash)

        if (!receipt) {
            return undefined
        }

        const eventId = utils.id('TransitTokenSent(address,uint256,address)')
        const log = receipt.logs.find((log: Log) => {
            return log.topics[0] === eventId
        })

        if (!log) {
            return undefined
        }

        const parsedLog = metarouter.interface.parseLog(log)

        const token = this.tokens().find((token: Token) => {
            return token.chainId === chainId && token.address.toLowerCase() === parsedLog.args.token.toLowerCase()
        })

        if (!token) {
            return undefined
        }

        return new TokenAmount(token, parsedLog.args.amount.toString())
    }

    async tronWaitForMined(chainId: ChainId, txId: string): Promise<TransactionInfo> {
        let info: TransactionInfo | undefined

        const tronWeb = this.tronWeb(chainId)

        const TRIES = 10
        for (let i = 0; i < TRIES; i++) {
            const response = await getTransactionInfoById(tronWeb, txId)
            if (response) {
                info = response
                break
            }

            await delay(1000)
        }

        if (!info) {
            throw new Error('Transaction not found')
        }

        return info
    }

    getRevertableAddress(chainId: ChainId): string {
        const address = this.config.revertableAddress[chainId]

        if (address) {
            return address
        }

        return this.config.revertableAddress.default
    }
}

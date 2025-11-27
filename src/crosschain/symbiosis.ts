import { Log, StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer, utils, BigNumber } from 'ethers'
import isomorphicFetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import TronWeb, { TransactionInfo } from 'tronweb'
import type { Counter, Histogram } from 'prom-client'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount, wrappedToken } from '../entities'
import {
    BranchedUnlocker,
    BranchedUnlocker__factory,
    Bridge,
    Bridge__factory,
    BtcRefundUnlocker,
    BtcRefundUnlocker__factory,
    Fabric,
    Fabric__factory,
    IDepository,
    IDepository__factory,
    IRouter,
    IRouter__factory,
    MetaRouter,
    MetaRouter__factory,
    MulticallRouter,
    MulticallRouter__factory,
    OmniPool,
    OmniPool__factory,
    OmniPoolOracle,
    OmniPoolOracle__factory,
    Portal,
    Portal__factory,
    SwapUnlocker,
    SwapUnlocker__factory,
    Synthesis,
    Synthesis__factory,
    TimedUnlocker,
    TimedUnlocker__factory,
    TonBridge,
    TonBridge__factory,
} from './contracts'
import {
    AdvisorError,
    aggregatorErrorToText,
    AmountLessThanFeeError,
    AmountTooHighError,
    AmountTooLowError,
    NoTransitTokenError,
    SdkError,
} from './sdkError'
import { RevertPending } from './revert'
import { getTransactionInfoById, isTronChainId } from './chainUtils/tron'
import {
    BtcConfig,
    ChainConfig,
    Config,
    CounterParams,
    DepositoryConfig,
    EvmAddress,
    FeeConfig,
    MetricParams,
    OmniPoolConfig,
    OneInchConfig,
    OpenOceanConfig,
    OverrideConfig,
    PriceImpactMetricParams,
    SwapExactInParams,
    SwapExactInResult,
    VolumeFeeCollector,
} from './types'
import { Zapping } from './zapping'
import { config as mainnet } from './config/mainnet'
import { config as testnet } from './config/testnet'
import { config as dev } from './config/dev'
import { config as beta } from './config/beta'
import { ConfigCache } from './config/cache/cache'
import { Id, OmniPoolInfo, TokenInfo } from './config/cache/builder'
import { PendingRequest } from './revertRequest'
import { delay } from '../utils'
import {
    waitForBtcCommitTxMined,
    waitForBtcDepositAccepted,
    waitForBtcEvmTxIssued,
    waitForComplete,
    waitFromTonTxMined,
} from './waitForComplete'
import { Cache } from './cache'
import { SwappingMiddleware } from './swapping'
import { parseUnits } from '@ethersproject/units'
import { swapExactIn } from './swapExactIn'
import { WaitForCompleteParams } from './waitForComplete/waitForComplete'
import { TonClient4 } from '@ton/ton'
import { getHttpV4Endpoint } from '@orbs-network/ton-access'
import { CoinGecko } from './coingecko'
import { isTonChainId, getUnwrapDustLimit } from './chainUtils'

export type ConfigName = 'dev' | 'testnet' | 'mainnet' | 'beta'

export type DiscountTier = {
    amount: string
    discount: number
}

export type DepositoryContext = {
    cfg: DepositoryConfig
    depository: IDepository
    router: IRouter
    branchedUnlocker: BranchedUnlocker
    swapUnlocker: SwapUnlocker
    timedUnlocker: TimedUnlocker
    btcRefundUnlocker?: BtcRefundUnlocker
}

const defaultFetch: typeof fetch = (url, init) => {
    return isomorphicFetch(url as string, init)
}

const VOLUME_FEE_COLLECTORS: VolumeFeeCollector[] = [
    // BNB chain
    {
        chainId: ChainId.BSC_MAINNET,
        address: '0x3743c756b64ECd0770f1d4f47696A73d2A46dcbe',
        feeRate: '2000000000000000', // 0.2%
        eligibleChains: [ChainId.BTC_MAINNET],
    },
]

export class Symbiosis {
    public providers: Map<ChainId, StaticJsonRpcProvider>

    public readonly cache: Cache
    public readonly config: Config
    public readonly configName: ConfigName
    private readonly configCache: ConfigCache
    public clientId: string

    private signature: string | undefined
    public sdkDurationMetric?: Histogram<string>
    public priceImpactSwapMetric?: Histogram<string>
    public counter?: Counter<string>

    public feesConfig?: FeeConfig[]

    public readonly oneInchConfig: OneInchConfig
    public readonly volumeFeeCollectors: VolumeFeeCollector[]
    public readonly openOceanConfig: OpenOceanConfig

    public readonly fetch: typeof fetch
    public readonly coinGecko: CoinGecko

    public setMetrics({
        symbiosisSdkDuration,
        priceImpactSwap,
    }: {
        symbiosisSdkDuration: Histogram<string>
        priceImpactSwap: Histogram<string>
    }) {
        this.sdkDurationMetric = symbiosisSdkDuration
        this.priceImpactSwapMetric = priceImpactSwap
    }

    public setErrorCounter(counter: Counter<string>) {
        this.counter = counter
    }

    public setSignature(signature: string | undefined) {
        this.signature = signature
    }

    public setFeesConfig(feesConfig: FeeConfig[]) {
        this.feesConfig = feesConfig
    }

    public setClientId(clientId: string) {
        this.clientId = utils.formatBytes32String(clientId)
    }

    public getBtcConfig(btc: Token): BtcConfig {
        const config = this.config.btcConfigs.find((i) => i.btc.equals(btc))
        if (!config) {
            throw new SdkError('BTC config not found')
        }
        return config
    }

    public async getDiscountTiers(): Promise<DiscountTier[]> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount/tiers`)

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new SdkError(json.message ?? text)
        }

        return await response.json()
    }

    public async getDiscountChains(): Promise<ChainId[]> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount/chains`)

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new SdkError(json.message ?? text)
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
            throw new SdkError(json.message ?? text)
        }

        const json = await response.json()

        return json['percent'] as number
    }

    public async checkDustLimit(amount: TokenAmount) {
        const btcConfig = this.config.btcConfigs.filter((i) => i.symBtc.chainId !== amount.token.chainId)[0]
        if (!btcConfig) {
            throw new SdkError(`BTC config for chain ${amount.token.chainId} not found`)
        }
        const dustLimit = await getUnwrapDustLimit(btcConfig.forwarderUrl, this.cache)
        if (BigNumber.from(amount.raw.toString()).lt(dustLimit)) {
            throw new AmountLessThanFeeError(`amountOut must be greater than dust limit: ${dustLimit} satoshi`)
        }
    }

    public constructor(configName: ConfigName, clientId: string, overrideConfig?: OverrideConfig) {
        this.configName = configName
        if (overrideConfig?.config) {
            this.config = overrideConfig.config
        } else {
            if (configName === 'mainnet') {
                this.config = structuredClone(mainnet)
            } else if (configName === 'testnet') {
                this.config = structuredClone(testnet)
            } else if (configName === 'dev') {
                this.config = structuredClone(dev)
            } else if (configName === 'beta') {
                this.config = structuredClone(beta)
            } else {
                throw new SdkError('Unknown config name')
            }

            if (overrideConfig?.chains) {
                const { chains } = overrideConfig
                this.config.chains = this.config.chains.map((chainConfig) => {
                    const found = chains.find((i) => i.id === chainConfig.id)
                    if (found) {
                        chainConfig.rpc = found.rpc
                        chainConfig.headers = found.headers
                    }
                    return chainConfig
                })
            }
            if (overrideConfig?.limits) {
                this.config.limits = overrideConfig.limits
            }
            if (overrideConfig?.advisor) {
                this.config.advisor = overrideConfig.advisor
            }
            if (overrideConfig?.btcConfigs) {
                this.config.btcConfigs = overrideConfig.btcConfigs
            }
        }
        this.oneInchConfig = {
            apiUrl: 'https://api.1inch.dev/swap/v5.2/',
            apiKeys: [], // <PUT_YOUR_API_KEY_HERE>
        }
        if (overrideConfig?.oneInchConfig) {
            this.oneInchConfig = { ...this.oneInchConfig, ...overrideConfig.oneInchConfig }
        }
        this.openOceanConfig = {
            apiUrl: 'https://open-api.openocean.finance/v4',
            apiKeys: [], // <PUT_YOUR_API_KEY_HERE>
        }
        if (overrideConfig?.openOceanConfig) {
            this.openOceanConfig = { ...this.openOceanConfig, ...overrideConfig.openOceanConfig }
        }

        this.volumeFeeCollectors = VOLUME_FEE_COLLECTORS
        if (overrideConfig?.volumeFeeCollectors) {
            this.volumeFeeCollectors = overrideConfig.volumeFeeCollectors
        }

        this.fetch = overrideConfig?.fetch ?? defaultFetch

        this.cache = overrideConfig?.cache || new Cache()
        this.configCache = new ConfigCache(overrideConfig?.configCache || configName)
        this.clientId = utils.formatBytes32String(clientId)

        this.providers = new Map(
            this.config.chains.map((chain) => {
                const rpc = isTronChainId(chain.id) ? `${chain.rpc}/jsonrpc` : chain.rpc
                const connection: utils.ConnectionInfo = { url: rpc }

                if (chain?.headers) {
                    connection.headers = chain.headers
                }

                return [chain.id, new StaticJsonRpcProvider(connection, chain.id)]
            })
        )
        this.coinGecko = new CoinGecko(this.config.coinGecko?.url, this.config.advisor.url, this.cache)
    }

    public createMetricTimer() {
        if (!this.sdkDurationMetric) {
            return
        }

        const endTimer = this.sdkDurationMetric.startTimer()

        return ({ tokenIn, tokenOut, operation, kind }: MetricParams) =>
            endTimer({
                operation,
                kind,
                chain_id_from: tokenIn?.chainId ?? '',
                chain_id_to: tokenOut?.chainId ?? '',
            })
    }

    public trackAggregatorError({ provider, reason, chain_id }: CounterParams) {
        if (!this.counter) {
            return
        }

        const partner_id = utils.parseBytes32String(this.clientId)

        const cleanReason = aggregatorErrorToText(reason)
        this.counter.inc({ provider, reason: cleanReason, chain_id, partner_id })
    }

    public trackPriceImpactSwap({ name_from, name_to, token_amount, price_impact }: PriceImpactMetricParams) {
        if (!this.priceImpactSwapMetric) {
            return
        }
        const amountBucket = [
            0.001, 0.01, 0.1, 0.5, 1, 5, 10, 50, 100, 1000, 3000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000,
            500_000, 1_000_000,
        ]

        const findNearestAmountIndex = (amount: number): number => {
            if (amount <= amountBucket[0]) {
                return 0
            }
            if (amount >= amountBucket[amountBucket.length - 1]) {
                return amountBucket.length - 1
            }

            let nearestIndex = 0
            let minDifference = Math.abs(amount - amountBucket[0])

            for (let i = 1; i < amountBucket.length; i++) {
                const difference = Math.abs(amount - amountBucket[i])
                if (difference < minDifference) {
                    minDifference = difference
                    nearestIndex = i
                }
            }

            return nearestIndex
        }

        if (price_impact >= 0.5) {
            const amountIndex = findNearestAmountIndex(token_amount)
            const amount_usd_bucket = amountBucket[amountIndex]

            this.priceImpactSwapMetric.observe({ name_from, name_to, amount_usd: amount_usd_bucket }, price_impact)
        }
    }

    public getVolumeFeeCollector(chainId: ChainId, involvedChainIds: ChainId[]): VolumeFeeCollector | undefined {
        const feeCollectors = this.volumeFeeCollectors.filter((i) => i.chainId === chainId)
        if (feeCollectors.length === 0) {
            return
        }

        const zeroFeeCollector = feeCollectors
            .filter((i) => i.feeRate === '0')
            .find((i) => {
                return involvedChainIds.every((j) => i.eligibleChains.includes(j))
            })
        if (zeroFeeCollector) {
            return
        }

        const chainEligibleFeeCollector = feeCollectors
            .filter((i) => i.feeRate !== '0')
            .find((i) => {
                return i.eligibleChains.filter((j) => involvedChainIds.includes(j)).length > 0
            })
        if (chainEligibleFeeCollector) {
            return chainEligibleFeeCollector
        }
        // get default volume fee collector
        return feeCollectors.find((i) => i.default)
    }

    public async getTonClient(): Promise<TonClient4> {
        return this.cache.get(
            ['tonClient'],
            async () => {
                let endpoint = this.config.chains.find((chain) => isTonChainId(chain.id))?.rpc
                if (!endpoint || endpoint.length === 0) {
                    endpoint = await getHttpV4Endpoint({
                        network: this.configName === 'mainnet' ? 'mainnet' : 'testnet',
                    })
                }

                return new TonClient4({
                    endpoint,
                })
            },
            600 // 10 minutes
        )
    }

    public chains(): Chain[] {
        const ids = this.config.chains.map((i) => i.id)
        return chains.filter((chain) => ids.includes(chain.id))
    }

    public swapExactIn(params: Omit<SwapExactInParams, 'symbiosis'>): Promise<SwapExactInResult> {
        return swapExactIn({ symbiosis: this, ...params })
    }

    public newSwapping(omniPoolConfig: OmniPoolConfig) {
        return new SwappingMiddleware(this, omniPoolConfig)
    }

    public newRevertPending(request: PendingRequest) {
        return new RevertPending(this, request)
    }

    public newZapping(omniPoolConfig: OmniPoolConfig) {
        return new Zapping(this, omniPoolConfig)
    }

    public getProvider(chainId: ChainId, rpc?: string): StaticJsonRpcProvider {
        if (rpc) {
            const url = isTronChainId(chainId) ? `${rpc}/jsonrpc` : rpc

            return new StaticJsonRpcProvider(url, chainId)
        }

        const provider = this.providers.get(chainId)
        if (!provider) {
            throw new SdkError(`No provider for given chainId: ${chainId}`)
        }
        return provider
    }

    public tonBridge(chainId: ChainId, address: string, signer?: Signer): TonBridge {
        const signerOrProvider = signer || this.getProvider(chainId)

        return TonBridge__factory.connect(address, signerOrProvider)
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

    public async depository(chainId: ChainId): Promise<DepositoryContext | null> {
        return this.cache.get(['depository', `${chainId}`], async () => {
            const cfg = this.chainConfig(chainId).depository
            if (!cfg) {
                return null
            }
            const signerOrProvider = this.getProvider(chainId)
            const depository = IDepository__factory.connect(cfg.depository, signerOrProvider)
            const routerAddress = await depository.router()

            return {
                cfg,
                depository,
                router: IRouter__factory.connect(routerAddress, signerOrProvider),
                swapUnlocker: SwapUnlocker__factory.connect(cfg.swapUnlocker, signerOrProvider),
                btcRefundUnlocker: cfg.btcRefundUnlocker
                    ? BtcRefundUnlocker__factory.connect(cfg.btcRefundUnlocker, signerOrProvider)
                    : undefined,
                timedUnlocker: TimedUnlocker__factory.connect(cfg.timedUnlocker, signerOrProvider),
                branchedUnlocker: BranchedUnlocker__factory.connect(cfg.branchedUnlocker, signerOrProvider),
            }
        })
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
            throw new AdvisorError(json.message ?? text)
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
        if (!config) {
            throw new SdkError(`Could not config by given chainId: ${chainId}`)
        }
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

    public transitTokens(chainId: ChainId, omniPoolConfig: OmniPoolConfig): Token[] {
        const pool = this.configCache.getOmniPoolByConfig(omniPoolConfig)
        if (!pool) {
            throw new SdkError(`Cannot find omniPool for chainId ${omniPoolConfig.chainId}`)
        }

        const tokens = this.configCache.tokens().filter((token) => {
            return token.chainId === chainId && !token.deprecated && !token.isSynthetic
        })

        return tokens.filter((token) => {
            const tokenPool = this.getOmniPoolByToken(token)
            return pool.id === tokenPool?.id
        })
    }

    public transitToken(chainId: ChainId, omniPoolConfig: OmniPoolConfig): Token {
        const pool = this.configCache.getOmniPoolByConfig(omniPoolConfig)
        if (!pool) {
            throw new SdkError(`Cannot find omniPool ${pool}`)
        }
        const tokens = this.configCache.tokens().filter((token) => {
            return token.chainId === chainId && !token.deprecated && !token.isSynthetic
        })
        if (tokens.length === 0) {
            throw new SdkError(`Cannot find token for chain ${chainId}`)
        }

        // if token is from manager chain (token's chainIs equals to pool chainId)
        if (chainId === pool.chainId) {
            return tokens[0]
        }

        // find the FIRST suitable token from the tokens list
        // e.g. the first token has priority
        const transitToken = tokens.find((token) => {
            return this.getOmniPoolByToken(token)?.id === pool.id
        })

        if (!transitToken) {
            throw new NoTransitTokenError(`Cannot find transitToken for chain ${chainId}. Pool: ${pool.id}`)
        }
        return transitToken
    }

    public getTransitCombinations({
        poolConfig,
        tokenIn,
        tokenOut,
        disableSrcChainRouting,
        disableDstChainRouting,
    }: {
        poolConfig: OmniPoolConfig
        tokenIn: Token
        tokenOut: Token
        disableSrcChainRouting?: boolean
        disableDstChainRouting?: boolean
    }) {
        const transitTokensIn = this.transitTokens(tokenIn.chainId, poolConfig)
        const transitTokensOut = this.transitTokens(tokenOut.chainId, poolConfig)

        const combinations: { transitTokenIn: Token; transitTokenOut: Token }[] = []

        transitTokensIn.forEach((transitTokenIn) => {
            transitTokensOut.forEach((transitTokenOut) => {
                if (transitTokenIn.equals(transitTokenOut)) {
                    return
                }
                if (disableSrcChainRouting) {
                    if (!transitTokenIn.equals(wrappedToken(tokenIn))) {
                        return
                    }
                }
                if (disableDstChainRouting) {
                    if (!transitTokenOut.equals(wrappedToken(tokenOut))) {
                        return
                    }
                }
                combinations.push({ transitTokenIn, transitTokenOut })
            })
        })

        return combinations
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

    public getTokenInfoById(tokenId: Id): TokenInfo {
        return this.configCache.getTokenInfoById(tokenId)
    }

    public tronWeb(chainId: ChainId): TronWeb {
        if (!isTronChainId(chainId)) {
            throw new SdkError(`Chain ${chainId} is not Tron chain`)
        }

        const config = this.chainConfig(chainId)
        if (!config) {
            throw new SdkError(`Could not find Tron config for chain ${chainId}`)
        }

        return new TronWeb({ fullHost: config.rpc, eventNode: config.rpc, solidityNode: config.rpc })
    }

    public async waitForComplete({
        chainId,
        txId,
        txTon,
    }: Omit<WaitForCompleteParams, 'symbiosis'>): Promise<string | undefined> {
        return waitForComplete({ symbiosis: this, chainId, txId, txTon })
    }

    public async waitForBtcDepositAccepted(depositAddress: string) {
        return Promise.any(
            this.config.btcConfigs.map((btcConfig) => {
                return waitForBtcDepositAccepted(btcConfig, depositAddress)
            })
        )
    }

    public async waitForBtcCommitTxMined(btcConfig: BtcConfig, commitTx: string) {
        return waitForBtcCommitTxMined({ btcConfig, commitTx })
    }

    public async waitForBtcEvmTxIssued(btcConfig: BtcConfig, revealTx: string) {
        return waitForBtcEvmTxIssued(this, revealTx, btcConfig)
    }

    public async waitFromTonTxMined(address: string, contractAddress: string) {
        return waitFromTonTxMined({ symbiosis: this, address, contractAddress })
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
            if (log.topics.length === 0) {
                return false
            }
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
            throw new SdkError('Transaction not found')
        }

        return info
    }

    getRevertableAddress(chainId: ChainId): EvmAddress {
        const address = this.config.revertableAddress[chainId]

        if (address) {
            return address
        }

        return this.config.revertableAddress.default
    }

    validateLimits(amount: TokenAmount): void {
        const { token } = amount
        const limit = this.config.limits.find((limit) => {
            return limit.address.toLowerCase() === token.address.toLowerCase() && limit.chainId === token.chainId
        })
        if (!limit) {
            return
        }
        const maxAmountRaw = parseUnits(limit.max, token.decimals).toString()
        if (maxAmountRaw !== '0') {
            const maxLimitTokenAmount = new TokenAmount(token, maxAmountRaw)
            if (amount.greaterThan(maxLimitTokenAmount)) {
                throw new AmountTooHighError(
                    `Max: ${maxLimitTokenAmount.toSignificant()} ${maxLimitTokenAmount.token.symbol}`
                )
            }
        }
        const minAmountRaw = parseUnits(limit.min, token.decimals).toString()
        if (minAmountRaw !== '0') {
            const minLimitTokenAmount = new TokenAmount(token, minAmountRaw)
            if (amount.lessThan(minLimitTokenAmount)) {
                throw new AmountTooLowError(
                    `Min: ${minLimitTokenAmount.toSignificant()} ${minLimitTokenAmount.token.symbol}`
                )
            }
        }
    }
}

import { Log, StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer, utils } from 'ethers'
import isomorphicFetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import TronWeb, { TransactionInfo } from 'tronweb'
import { Histogram } from 'prom-client'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount } from '../entities'
import {
    Bridge,
    Bridge__factory,
    Fabric,
    Fabric__factory,
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
    Synthesis,
    Synthesis__factory,
    TonBridge,
    TonBridge__factory,
} from './contracts'
import { Error, ErrorCode } from './error'
import { RevertPending } from './revert'
import { getTransactionInfoById, isTronChainId } from './chainUtils/tron'
import {
    BtcConfig,
    ChainConfig,
    Config,
    FeeConfig,
    MetricParams,
    OmniPoolConfig,
    OneInchConfig,
    OpenOceanConfig,
    OverrideConfig,
    SwapExactInParams,
    SwapExactInResult,
    VolumeFeeCollector,
} from './types'
import { Zapping } from './zapping'
import { config as mainnet } from './config/mainnet'
import { config as testnet } from './config/testnet'
import { config as dev } from './config/dev'
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
import { isTonChainId } from './chainUtils'

export type ConfigName = 'dev' | 'testnet' | 'mainnet'

export type DiscountTier = {
    amount: string
    discount: number
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
    // BOBA BNB
    {
        chainId: ChainId.BOBA_BNB,
        address: '0xe8035f3e32E1728A0558B67C6F410607d7Da2B6b',
        feeRate: '6000000000000000', // 0.6%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0xe63a8E9fD72e70121f99974A4E288Fb9e8668BBe',
        feeRate: '5000000000000000', // 0.5%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x5f5829F7CDca871b16ed76E498EeE35D4250738A',
        feeRate: '4000000000000000', // 0.4%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x0E8c084c7Edcf863eDdf0579A013b5c9f85462a2',
        feeRate: '3000000000000000', // 0.3%
        eligibleChains: [],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x56aE0251a9059fb35C21BffBe127d8E769A34D0D',
        feeRate: '2000000000000000', // 0.2%
        eligibleChains: [ChainId.TRON_MAINNET],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x602Bf79772763fEe47701FA2772F5aA9d505Fbf4',
        feeRate: '1000000000000000', // 0.1%
        eligibleChains: [ChainId.SEI_EVM_MAINNET, ChainId.MANTLE_MAINNET],
    },
    {
        chainId: ChainId.BOBA_BNB,
        address: '0x0f68eE6BD92dE3eD499142812C89F825e65d7241',
        feeRate: '500000000000000', // 0.05%
        eligibleChains: [],
        default: true,
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
    public metrics?: Histogram<string>

    public feesConfig?: FeeConfig[]

    public readonly oneInchConfig: OneInchConfig
    public readonly volumeFeeCollectors: VolumeFeeCollector[]
    public readonly openOceanConfig: OpenOceanConfig

    public readonly fetch: typeof fetch

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
            throw new Error('BTC config not found')
        }
        return config
    }

    public async getDiscountTiers(): Promise<DiscountTier[]> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount/tiers`)

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(json.message ?? text)
        }

        return await response.json()
    }

    public async getDiscountChains(): Promise<ChainId[]> {
        const response = await this.fetch(`${this.config.advisor.url}/v1/swap/discount/chains`)

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

    public constructor(
        configName: ConfigName,
        clientId: string,
        overrideConfig?: OverrideConfig,
        metrics?: Histogram<string>
    ) {
        this.configName = configName
        if (configName === 'mainnet') {
            this.config = structuredClone(mainnet)
        } else if (configName === 'testnet') {
            this.config = structuredClone(testnet)
        } else if (configName === 'dev') {
            this.config = structuredClone(dev)
        } else {
            throw new Error('Unknown config name')
        }
        this.cache = new Cache()

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
        if (overrideConfig?.limits) {
            this.config.limits = overrideConfig.limits
        }
        if (overrideConfig?.advisor) {
            this.config.advisor = overrideConfig.advisor
        }
        if (overrideConfig?.btcConfigs) {
            this.config.btcConfigs = overrideConfig.btcConfigs
        }
        this.oneInchConfig = {
            apiUrl: 'https://api.1inch.dev/swap/v5.2/',
            apiKeys: [], // <PUT_YOUR_API_KEY_HERE>
        }
        if (overrideConfig?.oneInchConfig) {
            this.oneInchConfig = overrideConfig.oneInchConfig
        }
        this.openOceanConfig = {
            apiUrl: 'https://open-api.openocean.finance/v4',
            apiKeys: [], // <PUT_YOUR_API_KEY_HERE>
        }
        if (overrideConfig?.openOceanConfig) {
            this.openOceanConfig = overrideConfig.openOceanConfig
        }

        this.volumeFeeCollectors = VOLUME_FEE_COLLECTORS
        if (overrideConfig?.volumeFeeCollectors) {
            this.volumeFeeCollectors = overrideConfig.volumeFeeCollectors
        }

        this.fetch = overrideConfig?.fetch ?? defaultFetch

        this.configCache = new ConfigCache(configName)

        this.clientId = utils.formatBytes32String(clientId)

        this.providers = new Map(
            this.config.chains.map((chain) => {
                const rpc = isTronChainId(chain.id) ? `${chain.rpc}/jsonrpc` : chain.rpc

                return [chain.id, new StaticJsonRpcProvider(rpc, chain.id)]
            })
        )

        this.metrics = metrics
    }

    public createMetricTimer({ id, tokenIn, tokenOut, operation, kind, addressFrom, addressTo }: MetricParams) {
        if (!this.metrics) {
            throw new Error('Prometheus metrics are not initialized')
        }

        const endTimer = this.metrics.startTimer()

        return () =>
            endTimer({
                id,
                operation: operation,
                kind,
                chain_id_from: tokenIn?.chainId ?? '',
                chain_id_to: tokenOut?.chainId ?? '',
                token_in: tokenIn?.address ?? '',
                token_out: tokenOut?.address ?? '',
                address_from: addressFrom ?? '',
                address_to: addressTo ?? '',
                rpc_from: tokenIn ? this.getProvider(tokenIn?.chainId).connection.url : '',
                rpc_to: tokenOut ? this.getProvider(tokenOut?.chainId).connection.url : '',
            })
    }

    public getVolumeFeeCollector(chainId: ChainId, involvedChainIds: ChainId[]): VolumeFeeCollector | undefined {
        const feeCollectors = this.volumeFeeCollectors.filter((i) => i.chainId === chainId)
        if (feeCollectors.length === 0) {
            return
        }
        const chainEligibleFeeCollector = feeCollectors.find((i) => {
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
            throw new Error(`No provider for given chainId: ${chainId}`)
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
            throw new Error(json.message ?? text, ErrorCode.ADVISOR_ERROR)
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

    public transitTokens(chainId: ChainId, omniPoolConfig: OmniPoolConfig): Token[] {
        const pool = this.configCache.getOmniPoolByConfig(omniPoolConfig)
        if (!pool) {
            throw new Error(`Cannot find omniPool ${pool}`)
        }

        const tokens = this.configCache.tokens().filter((token) => {
            return token.chainId === chainId && !token.deprecated && !token.isSynthetic
        })

        // if token is from manager chain (token's chainIs equals to pool chainId)
        if (chainId === pool.chainId) {
            return tokens
        }

        return tokens.filter((token) => {
            const tokenPool = this.getOmniPoolByToken(token)
            return pool.id === tokenPool?.id
        })
    }

    public transitToken(chainId: ChainId, omniPoolConfig: OmniPoolConfig): Token {
        const pool = this.configCache.getOmniPoolByConfig(omniPoolConfig)
        if (!pool) {
            throw new Error(`Cannot find omniPool ${pool}`)
        }
        const tokens = this.configCache.tokens().filter((token) => {
            return token.chainId === chainId && !token.deprecated && !token.isSynthetic
        })
        if (tokens.length === 0) {
            throw new Error(`Cannot find token for chain ${chainId}`)
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
            throw new Error(
                `Cannot find transitToken for chain ${chainId}. Pool: ${pool.id}`,
                ErrorCode.NO_TRANSIT_TOKEN
            )
        }
        return transitToken
    }

    public getTransitCombinations(chainIdIn: ChainId, chainIdOut: ChainId, poolConfig: OmniPoolConfig) {
        const transitTokensIn = this.transitTokens(chainIdIn, poolConfig)
        const transitTokensOut = this.transitTokens(chainIdOut, poolConfig)

        const combinations: { transitTokenIn: Token; transitTokenOut: Token }[] = []

        transitTokensIn.forEach((transitTokenIn) => {
            transitTokensOut.forEach((transitTokenOut) => {
                if (transitTokenIn.equals(transitTokenOut)) {
                    return
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
            throw new Error(`Chain ${chainId} is not Tron chain`)
        }

        const config = this.chainConfig(chainId)
        if (!config) {
            throw new Error(`Could not find Tron config for chain ${chainId}`)
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
                throw new Error(
                    `Swap amount is too high. Max: ${maxLimitTokenAmount.toSignificant()} ${
                        maxLimitTokenAmount.token.symbol
                    }`,
                    ErrorCode.AMOUNT_TOO_HIGH
                )
            }
        }
        const minAmountRaw = parseUnits(limit.min, token.decimals).toString()
        if (minAmountRaw !== '0') {
            const minLimitTokenAmount = new TokenAmount(token, minAmountRaw)
            if (amount.lessThan(minLimitTokenAmount)) {
                throw new Error(
                    `Swap amount is too low. Min: ${minLimitTokenAmount.toSignificant()} ${
                        minLimitTokenAmount.token.symbol
                    }`,
                    ErrorCode.AMOUNT_TOO_LOW
                )
            }
        }
    }
}

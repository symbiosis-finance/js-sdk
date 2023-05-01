import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, Signer, utils, EventFilter, Contract } from 'ethers'
// import fetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount } from '../entities'
import { Bridging } from './bridging'
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
    MetaRouter,
    MetaRouter__factory,
    MulticallRouter,
    MulticallRouter__factory,
    MuteRouter,
    MuteRouter__factory,
    NervePool,
    NervePool__factory,
    OmniPool,
    OmniPool__factory,
    OmniPoolOracle,
    OmniPoolOracle__factory,
    OneInchOracle,
    OneInchOracle__factory,
    Ooki,
    Ooki__factory,
    Portal,
    Portal__factory,
    RenGatewayRegistryV2,
    RenGatewayRegistryV2__factory,
    RenMintGatewayV3,
    RenMintGatewayV3__factory,
    Synthesis,
    Synthesis__factory,
    UniLikeRouter,
    UniLikeRouter__factory,
} from './contracts'
import { Error, ErrorCode } from './error'
import { getRepresentation } from './getRepresentation'
import { getPendingRequests, PendingRequest, SynthesizeRequestFinder } from './pending'
import { RevertPending } from './revert'
import { Swapping } from './swapping'
import { ChainConfig, Config, OmniPoolConfig, PoolAsset } from './types'
import { ONE_INCH_ORACLE_MAP } from './constants'
import { Zapping } from './zapping'
import { ZappingAave } from './zappingAave'
import { ZappingCream } from './zappingCream'
import { ZappingRenBTC } from './zappingRenBTC'
import { ZappingOoki } from './zappingOoki'
import TronWeb from 'tronweb'
import { config as mainnet } from './config/mainnet'
import { config as testnet } from './config/testnet'
import { ZappingBeefy } from './zappingBeefy'
import { getTransactionInfoById, isTronChainId, tronAddressToEvm } from './tron'
import { TRON_PORTAL_ABI } from './tronAbis'
import { DEFAULT_EXCEED_DELAY, getExternalId, getLogWithTimeout } from './utils'

type ConfigName = 'testnet' | 'mainnet'

export class Symbiosis {
    public providers: Map<ChainId, StaticJsonRpcProvider>

    public readonly config: Config
    public readonly clientId: string
    public readonly omniPoolConfig: OmniPoolConfig

    public constructor(config: ConfigName | Config, clientId: string) {
        if (config === 'mainnet') {
            this.config = mainnet
        } else if (config === 'testnet') {
            this.config = testnet
        } else {
            this.config = config
        }
        this.omniPoolConfig = this.config.omniPool
        this.clientId = utils.formatBytes32String(clientId)

        this.providers = new Map(
            this.config.chains.map((i) => {
                return [i.id, new StaticJsonRpcProvider(i.rpc, i.id)]
            })
        )
    }

    public validateSwapAmounts(amount: TokenAmount) {
        const parsedAmount = parseFloat(amount.toExact(2))
        const minAmount = this.config.minSwapAmountInUsd
        const maxAmount = this.config.maxSwapAmountInUsd
        if (parsedAmount < minAmount) {
            throw new Error(
                `The amount is too low: $${parsedAmount}. Min amount: $${minAmount}`,
                ErrorCode.AMOUNT_TOO_LOW
            )
        } else if (parsedAmount > maxAmount) {
            throw new Error(
                `The amount is too high: $${parsedAmount}. Max amount: $${maxAmount}`,
                ErrorCode.AMOUNT_TOO_HIGH
            )
        } else {
            // All it`s OK
        }
    }

    public chains(): Chain[] {
        const ids = this.config.chains.map((i) => i.id)
        return chains.filter((i) => ids.includes(i.id))
    }

    public newBridging() {
        return new Bridging(this)
    }

    public newSwapping() {
        return new Swapping(this)
    }

    public newRevertPending(request: PendingRequest) {
        return new RevertPending(this, request)
    }

    public newZapping() {
        return new Zapping(this)
    }

    public newZappingAave() {
        return new ZappingAave(this)
    }

    public newZappingCream() {
        return new ZappingCream(this)
    }

    public newZappingRenBTC() {
        return new ZappingRenBTC(this)
    }

    public newZappingBeefy() {
        return new ZappingBeefy(this)
    }

    public newZappingOoki() {
        return new ZappingOoki(this)
    }

    public getPendingRequests(
        address: string,
        synthesizeRequestFinder?: SynthesizeRequestFinder
    ): Promise<PendingRequest[]> {
        return getPendingRequests(this, address, synthesizeRequestFinder)
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

    public muteRouter(chainId: ChainId, signer?: Signer): MuteRouter {
        const address = this.chainConfig(chainId).router
        const signerOrProvider = signer || this.getProvider(chainId)

        return MuteRouter__factory.connect(address, signerOrProvider)
    }

    public nervePool(tokenA: Token, tokenB: Token, signer?: Signer): NervePool {
        const chainId = tokenA.chainId
        const address = this.chainConfig(chainId).nerves.find((data) => {
            return (
                data.tokens.find((token) => token.toLowerCase() === tokenA.address.toLowerCase()) &&
                data.tokens.find((token) => token.toLowerCase() === tokenB.address.toLowerCase())
            )
        })?.address

        if (!address) {
            throw new Error('Nerve pool not found')
        }
        const signerOrProvider = signer || this.getProvider(chainId)

        return NervePool__factory.connect(address, signerOrProvider)
    }

    public getNerveTokenIndexes(chainId: ChainId, tokenA: string, tokenB: string) {
        const pool = this.chainConfig(chainId).nerves.find((data) => {
            return (
                data.tokens.find((token) => token.toLowerCase() === tokenA.toLowerCase()) &&
                data.tokens.find((token) => token.toLowerCase() === tokenB.toLowerCase())
            )
        })

        if (!pool) {
            throw new Error('Nerve pool not found')
        }

        const tokens = pool.tokens.map((i) => i.toLowerCase())
        const indexA = tokens.indexOf(tokenA.toLowerCase())
        const indexB = tokens.indexOf(tokenB.toLowerCase())

        if (indexA === -1 || indexB === -1) {
            throw new Error('Cannot find token')
        }

        return [indexA, indexB]
    }

    public nervePoolByAddress(address: string, chainId: ChainId, signer?: Signer): NervePool {
        const signerOrProvider = signer || this.getProvider(chainId)

        return NervePool__factory.connect(address, signerOrProvider)
    }

    public nervePoolBySynth(synthTokenAddress: string, chainId: ChainId, signer?: Signer): NervePool {
        const pool = this.chainConfig(chainId).nerves.find((data) => {
            return data.tokens[1].toLowerCase() === synthTokenAddress.toLowerCase()
        })

        if (!pool) {
            throw new Error('Nerve pool not found')
        }

        const signerOrProvider = signer || this.getProvider(chainId)

        return NervePool__factory.connect(pool.address, signerOrProvider)
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

    public omniPool(signer?: Signer): OmniPool {
        const { address, chainId } = this.omniPoolConfig
        const signerOrProvider = signer || this.getProvider(chainId)

        return OmniPool__factory.connect(address, signerOrProvider)
    }

    public omniPoolOracle(signer?: Signer): OmniPoolOracle {
        const { oracle, chainId } = this.omniPoolConfig
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

    public renRenGatewayRegistry(chainId: ChainId, signer?: Signer): RenGatewayRegistryV2 {
        const address = this.chainConfig(chainId).renGatewayRegistry
        const signerOrProvider = signer || this.getProvider(chainId)

        return RenGatewayRegistryV2__factory.connect(address, signerOrProvider)
    }

    public renMintGatewayByAddress(address: string, chainId: ChainId, signer?: Signer): RenMintGatewayV3 {
        const signerOrProvider = signer || this.getProvider(chainId)

        return RenMintGatewayV3__factory.connect(address, signerOrProvider)
    }

    public beefyVault(address: string, chainId: ChainId, signer?: Signer): BeefyVault {
        const signerOrProvider = signer || this.getProvider(chainId)

        return BeefyVault__factory.connect(address, signerOrProvider)
    }

    public ookiIToken(address: string, chainId: ChainId, signer?: Signer): Ooki {
        const signerOrProvider = signer || this.getProvider(chainId)

        return Ooki__factory.connect(address, signerOrProvider)
    }

    public stables(): Token[] {
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

    public findSyntheticStable(chainId: ChainId, chainFromId: ChainId): Token | undefined {
        return this.stables().find((token) => {
            return token.chainId === chainId && token.chainFromId === chainFromId && token.isSynthetic
        })
    }

    public findStable(address: string, chainId: ChainId, chainFromId?: ChainId): Token | undefined {
        return this.stables().find((token) => {
            const condition = token.address.toLowerCase() === address.toLowerCase() && token.chainId === chainId

            if (chainFromId === undefined) return condition

            return condition && token.chainFromId === chainFromId
        })
    }

    public async getRepresentation(token: Token, chainId: ChainId): Promise<Token | undefined> {
        return getRepresentation(this, token, chainId)
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
    }): Promise<JSBI> {
        const params = {
            chain_id_from: chainIdFrom,
            chain_id_to: chainIdTo,
            receive_side: receiveSide,
            call_data: calldata,
            client_id: utils.parseBytes32String(this.clientId),
        }

        return fetch(`${this.config.advisor.url}/v1/swap/price`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        })
            .then(async (response) => {
                if (!response.ok) {
                    return Promise.reject(new Error(await response.text()))
                }
                return response.json()
            })
            .then(({ price }) => JSBI.BigInt(price))
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

    public transitStables(chainId: ChainId): Token[] {
        const stables = this.findTransitStables(chainId)
        if (stables.length === 0) {
            throw new Error(`Cannot find transit stable token for chain ${chainId}`)
        }
        return stables
    }

    public async bestTransitStable(chainId: ChainId): Promise<Token> {
        const stables = this.transitStables(chainId)
        if (stables.length === 1) {
            return stables[0]
        }

        const pool = this.omniPool()
        const promises = stables.map(async (i): Promise<[Token, PoolAsset] | undefined> => {
            const sToken = await getRepresentation(this, i, ChainId.BOBA_BNB)
            if (!sToken) return
            const index = await pool.assetToIndex(sToken.address)
            const asset = await pool.indexToAsset(index)
            return [i, asset]
        })

        const pairs = (await Promise.all(promises)).filter((i) => i !== undefined) as [Token, PoolAsset][]

        function assetScore(asset: PoolAsset): BigNumber {
            const cash = asset.cash
            const liability = asset.liability

            if (liability.eq(0)) {
                return BigNumber.from(0)
            }

            return cash.mul(cash).div(liability)
        }

        const sortedPairs = pairs.sort((pairA, pairB) => {
            const a = assetScore(pairA[1])
            const b = assetScore(pairB[1])

            if (a.gt(b)) {
                return -1
            }
            if (a.lt(b)) {
                return 1
            }
            return 0
        })

        return sortedPairs[0][0]
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

    public findTransitStables(chainId: ChainId): Token[] {
        return this.stables().filter((token) => {
            return token.chainId === chainId && !token.isSynthetic
        })
    }

    public async waitForComplete(chainId: ChainId, txId: string) {
        let externalId: string
        let externalChainId: ChainId
        let direction: 'burn' | 'mint'
        if (isTronChainId(chainId)) {
            direction = 'mint'

            const tronWeb = this.tronWeb(chainId)
            const result = await getTransactionInfoById(tronWeb, txId)

            if (!result) {
                throw new Error(`Transaction ${txId} not found`)
            }

            let { portal: portalAddress } = this.chainConfig(chainId)

            portalAddress = TronWeb.address.toHex(portalAddress)

            if (result.contract_address !== portalAddress) {
                throw new Error(`Transaction ${txId} is not a portal transaction`)
            }

            const portalInterface = new utils.Interface(TRON_PORTAL_ABI)
            const topic = portalInterface.getEventTopic('SynthesizeRequest').replace('0x', '')

            const synthesizeRequest = result.log.find((log) => log.topics[0] === topic)

            if (!synthesizeRequest) {
                throw new Error(`Cannot find SynthesizeRequest event in transaction ${txId}`)
            }

            const evmCompatible = {
                data: `0x${synthesizeRequest.data}`,
                topics: synthesizeRequest.topics.map((topic) => `0x${topic}`),
            }

            const event = portalInterface.parseLog(evmCompatible)

            const { id, chainID, revertableAddress } = event.args

            externalChainId = chainID.toNumber()

            const synthesisAddress = this.chainConfig(externalChainId).synthesis

            externalId = getExternalId({
                internalId: id,
                contractAddress: tronAddressToEvm(synthesisAddress),
                revertableAddress: tronAddressToEvm(revertableAddress),
                chainId: externalChainId,
            })
        } else {
            const provider = this.getProvider(chainId)

            const receipt = await provider.getTransactionReceipt(txId)

            if (!receipt) {
                throw new Error(`Transaction ${txId} not found`)
            }

            const portal = this.portal(chainId)
            const synthesis = this.synthesis(chainId)

            const synthesizeRequestTopic = portal.interface.getEventTopic('SynthesizeRequest')
            const burnRequestTopic = synthesis.interface.getEventTopic('BurnRequest')

            const log = receipt.logs.find((log) => {
                return log.topics.includes(synthesizeRequestTopic) || log.topics.includes(burnRequestTopic)
            })

            if (!log) {
                throw new Error(`Cannot find SynthesizeRequest or BurnRequest event in transaction ${txId}`)
            }

            if (log.address !== portal.address && log.address !== synthesis.address) {
                throw new Error(`Transaction ${txId} is not a from synthesis or portal contract`)
            }

            const contract = log.address === portal.address ? portal : synthesis
            const { id, chainID, revertableAddress } = contract.interface.parseLog(log).args

            externalChainId = chainID.toNumber()

            const contractAddress = this.chainConfig(externalChainId).portal // @@

            externalId = getExternalId({
                internalId: id,
                contractAddress: tronAddressToEvm(contractAddress),
                revertableAddress: tronAddressToEvm(revertableAddress),
                chainId: externalChainId,
            })

            externalChainId = chainID.toNumber()
            direction = 'mint'
        }

        if (isTronChainId(externalChainId)) {
            const { portal } = this.chainConfig(externalChainId)

            const contract = new Contract(tronAddressToEvm(portal), TRON_PORTAL_ABI)
            const filter = contract.filters.BurnCompleted(externalId)

            const tronWeb = this.tronWeb(externalChainId)

            let startBlockNumber: number | 'earliest' = 'earliest'
            const start = Date.now()
            while (Date.now() - start < DEFAULT_EXCEED_DELAY) {
                // eth_newFilter is not working for some reason on Tron, so we have to poll
                const [{ result: getLogsResult }, { result: blockNumber }] = await tronWeb.fullNode.request(
                    'jsonrpc',
                    [
                        {
                            id: 1,
                            method: 'eth_getLogs',
                            params: [{ ...filter, fromBlock: startBlockNumber, toBlock: 'latest' }],
                            jsonrpc: '2.0',
                        },
                        {
                            id: 2,
                            method: 'eth_blockNumber',
                            params: [],
                            jsonrpc: '2.0',
                        },
                    ] as unknown as Record<string, unknown>,
                    'post'
                )

                if (getLogsResult.length) {
                    return getLogsResult[0].transactionHash
                }

                startBlockNumber = blockNumber

                await new Promise((resolve) => setTimeout(resolve, 1000))
            }

            throw new Error(`Burn transaction not found for ${txId}`)
        }

        let filter: EventFilter
        if (direction === 'mint') {
            const synthesis = this.synthesis(externalChainId)
            filter = synthesis.filters.SynthesizeCompleted(externalId)
        } else {
            const portal = this.portal(externalChainId)
            filter = portal.filters.BurnCompleted(externalId)
        }

        const log = await getLogWithTimeout({ symbiosis: this, chainId: externalChainId, filter })

        return log.transactionHash
    }
}

import { Log, StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer, utils } from 'ethers'
import fetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount } from '../entities'
import { Bridging } from './bridging'
import { ConnectConfig, Near, connect as nearConnect } from 'near-api-js'
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
    BridgeV2NonEvm,
    BridgeV2NonEvm__factory,
    Bridge__factory,
    CreamCErc20,
    CreamCErc20__factory,
    CreamComptroller,
    CreamComptroller__factory,
    Fabric,
    Fabric__factory,
    MetaRouter,
    MetaRouter__factory,
    MulticallRouter,
    MulticallRouter__factory,
    NervePool,
    NervePool__factory,
    OneInchOracle,
    OneInchOracle__factory,
    Portal,
    Portal__factory,
    RenGatewayRegistryV2,
    RenGatewayRegistryV2__factory,
    RenMintGatewayV3,
    RenMintGatewayV3__factory,
    SyntFabricNonEvm,
    SyntFabricNonEvm__factory,
    Synthesis,
    SynthesisNonEvm,
    SynthesisNonEvm__factory,
    Synthesis__factory,
    UniLikeRouter,
    UniLikeRouter__factory,
} from './contracts'
import { Error, ErrorCode } from './error'
import { getRepresentation } from './getRepresentation'
import { getPendingRequests, PendingRequest } from './pending'
import { RevertPending } from './revert'
import { Swapping } from './swapping'
import { ChainConfig, Config } from './types'
import { ONE_INCH_ORACLE_MAP } from './constants'
import { Zapping } from './zapping'
import { ZappingAave } from './zappingAave'
import { ZappingCream } from './zappingCream'
import { ZappingRenBTC } from './zappingRenBTC'

import { config as mainnet } from './config/mainnet'
import { config as testnet } from './config/testnet'
import { ZappingBeefy } from './zappingBeefy'
import { isNearChainId } from '../utils'
import { WaitForComplete, WaitForCompleteParams } from './waitForComplete'

type ConfigName = 'testnet' | 'mainnet'

export class Symbiosis {
    public providers: Map<ChainId, StaticJsonRpcProvider>

    public readonly config: Config
    public readonly clientId: string

    public constructor(config: ConfigName | Config, clientId: string) {
        if (config === 'mainnet') {
            this.config = mainnet
        } else if (config === 'testnet') {
            this.config = testnet
        } else {
            this.config = config
        }

        this.clientId = utils.formatBytes32String(clientId)

        this.providers = new Map<ChainId, StaticJsonRpcProvider>()
        for (const chain of this.config.chains) {
            if (isNearChainId(chain.id)) {
                continue
            }

            this.providers.set(chain.id, new StaticJsonRpcProvider(chain.rpc, chain.id))
        }
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

    public getPendingRequests(address: string): Promise<PendingRequest[]> {
        return getPendingRequests(this, address)
    }

    public getProvider(chainId: ChainId): StaticJsonRpcProvider {
        const provider = this.providers.get(chainId)

        if (!provider) {
            throw new Error('No provider for given chainId')
        }

        return provider
    }

    public getNearConnection(chainId: ChainId, configOverride?: Partial<ConnectConfig>): Promise<Near> {
        if (!isNearChainId(chainId)) {
            throw new Error('Not a near ChainID')
        }

        const chain = this.config.chains.find((chain) => chain.id === chainId)

        if (!chain || !chain.nonEvmParams) {
            throw new Error('No chain config for given chainId')
        }

        return nearConnect({
            headers: {},
            ...chain.nonEvmParams,
            ...configOverride,
        })
    }

    public portal(chainId: ChainId, signer?: Signer): Portal {
        const address = this.chainConfig(chainId).portal
        const signerOrProvider = signer || this.getProvider(chainId)

        return Portal__factory.connect(address, signerOrProvider)
    }

    public synthesis(chainId: ChainId, signer?: Signer): Synthesis {
        const address = this.chainConfig(chainId).synthesis
        const signerOrProvider = signer ?? this.getProvider(chainId)

        return Synthesis__factory.connect(address, signerOrProvider)
    }

    public synthesisNonEvm(chainId: ChainId, signer?: Signer): SynthesisNonEvm {
        const address = this.chainConfig(chainId).synthesisNonEvm

        if (!address) {
            throw new Error(`No SynthesisNonEvm contract address for given chainId ${chainId}`)
        }

        const signerOrProvider = signer ?? this.getProvider(chainId)

        return SynthesisNonEvm__factory.connect(address, signerOrProvider)
    }

    public bridge(chainId: ChainId, signer?: Signer): Bridge {
        const address = this.chainConfig(chainId).bridge
        const signerOrProvider = signer ?? this.getProvider(chainId)

        return Bridge__factory.connect(address, signerOrProvider)
    }

    public bridgeV2NonEvm(chainId: ChainId, signer?: Signer): BridgeV2NonEvm {
        const address = this.chainConfig(chainId).bridgeV2NonEvm

        if (!address) {
            throw new Error(`No bridgeV2NonEvm address for given chainId ${chainId}`)
        }

        const signerOrProvider = signer ?? this.getProvider(chainId)

        return BridgeV2NonEvm__factory.connect(address, signerOrProvider)
    }

    public fabric(chainId: ChainId, signer?: Signer): Fabric {
        const address = this.chainConfig(chainId).fabric
        const signerOrProvider = signer ?? this.getProvider(chainId)

        return Fabric__factory.connect(address, signerOrProvider)
    }

    public fabricNonEvm(chainId: ChainId, signer?: Signer): SyntFabricNonEvm {
        const address = this.chainConfig(chainId).syntFabricNonEvm

        if (!address) {
            throw new Error(`No fabricNonEvm address for given chainId ${chainId}`)
        }

        const signerOrProvider = signer ?? this.getProvider(chainId)

        return SyntFabricNonEvm__factory.connect(address, signerOrProvider)
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

    public nervePool(tokenIn: Token, tokenOut: Token, signer?: Signer): NervePool {
        const chainId = tokenIn.chainId
        const address = this.chainConfig(chainId).nerves.find((data) => {
            return (
                data.tokens.find((token) => token.toLowerCase() === tokenIn.address.toLowerCase()) &&
                data.tokens.find((token) => token.toLowerCase() === tokenOut.address.toLowerCase())
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

    public findTransitStable(chainId: ChainId): Token | undefined {
        return this.stables().find((token) => {
            return token.chainId === chainId && !token.isSynthetic
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

    public findSyntheticStable(chainId: ChainId, chainFromId: ChainId): Token | undefined {
        return this.stables().find((token) => {
            return token.chainId === chainId && token.chainFromId === chainFromId && token.isSynthetic
        })
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

    public transitStable(chainId: ChainId): Token {
        const stable = this.findTransitStable(chainId)
        if (stable === undefined) {
            throw new Error(`Cannot find transit stable token for chain ${chainId}`)
        }
        return stable
    }

    public isTransitStable(token: Token): boolean {
        return token.address === this.transitStable(token.chainId).address
    }

    public waitForComplete({
        externalId,
        ...params
    }: Omit<WaitForCompleteParams, 'symbiosis'> & { externalId: string }): Promise<Log> {
        return new WaitForComplete({ ...params, symbiosis: this }).waitForCompleteFromParams(
            externalId,
            this.synthesisNonEvm(params.tokenOut.chainId).address
        )
    }
}

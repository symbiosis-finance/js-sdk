import { StaticJsonRpcProvider } from '@ethersproject/providers'
import { Signer } from 'ethers'
import fetch from 'isomorphic-unfetch'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Chain, chains, Token, TokenAmount } from '../entities'
import { Bridging } from './bridging'
import {
    Aave,
    Aave__factory,
    AvaxRouter,
    AvaxRouter__factory,
    Bridge,
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
    Synthesis,
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

export class Symbiosis {
    public providers: Map<ChainId, StaticJsonRpcProvider>

    public readonly config: Config

    public constructor(config: Config) {
        this.config = config

        this.providers = new Map(
            config.chains.map((i) => {
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

    public nervePoolByAddress(address: string, chainId: ChainId, signer?: Signer): NervePool {
        const signerOrProvider = signer || this.getProvider(chainId)

        return NervePool__factory.connect(address, signerOrProvider)
    }

    public creamCErc20ByAddress(address: string, chainId: ChainId, signer?: Signer): CreamCErc20 {
        const signerOrProvider = signer || this.getProvider(chainId)

        return CreamCErc20__factory.connect(address, signerOrProvider)
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

    private chainConfig(chainId: ChainId): ChainConfig {
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
}

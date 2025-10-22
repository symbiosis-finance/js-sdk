import JSBI from 'jsbi'
import invariant from 'tiny-invariant'
import { ChainId, Icons, SolidityType, TokenConstructor } from '../constants'
import { isTronChainId, tronAddressToEvm } from '../crosschain'
import { validateAndParseAddress, validateSolidityTypeInstance } from '../utils'
import { Chain, getChainById } from './chain'

/**
 * A token is any fungible financial instrument on Ethereum.
 *
 */
export class Token {
    public readonly decimals: number
    public readonly symbol?: string
    public readonly name?: string
    public readonly chainId: ChainId
    public readonly address: string
    public readonly icons?: Icons
    public readonly chainFromId?: ChainId
    public readonly isNative: boolean
    public readonly userToken?: boolean
    public readonly deprecated: boolean
    public readonly attributes?: {
        solana?: string
        ton?: string
    }

    /**
     * Constructs an instance of the base class `Token`.
     * @param params TokenConstructor
     */
    constructor(params: TokenConstructor) {
        validateSolidityTypeInstance(JSBI.BigInt(params.decimals), SolidityType.uint8)

        this.decimals = params.decimals
        this.symbol = params.symbol
        this.name = params.name
        this.chainId = params.chainId
        this.isNative = !!params.isNative
        this.icons = params.icons
        this.chainFromId = params.chainFromId
        this.userToken = params.userToken
        this.deprecated = !!params.deprecated
        this.attributes = params.attributes

        if (isTronChainId(params.chainId)) {
            this.address = tronAddressToEvm(params.address)
            return
        }

        this.address = validateAndParseAddress(params.address)
    }

    /**
     * Returns true if the two tokens are equivalent, i.e. have the same chainId and address.
     * @param other other token to compare
     */
    public equals(other: Token): boolean {
        // short circuit on reference equality
        if (this === other) {
            return true
        }
        return this.chainId === other.chainId && this.address === other.address
    }

    /**
     * Returns true if the address of this token sorts before the address of the other token
     * @param other other token to compare
     * @throws if the tokens have the same address
     * @throws if the tokens are on different chains
     */
    public sortsBefore(other: Token): boolean {
        invariant(this.chainId === other.chainId, 'CHAIN_IDS')
        invariant(this.address !== other.address, 'ADDRESSES')
        return this.address.toLowerCase() < other.address.toLowerCase()
    }
    get isSynthetic() {
        return !!this.chainFromId
    }

    get chain(): Chain | undefined {
        return getChainById(this.chainId)
    }

    get chainFrom(): Chain | undefined {
        return getChainById(this.chainFromId)
    }

    get tonAddress(): string {
        if (!this.attributes?.ton) {
            throw new Error(`${this.name} has no ton address`)
        }
        return this.attributes.ton
    }

    get solAddress(): string {
        if (!this.attributes?.solana) {
            throw new Error(`${this.name} has no solana address`)
        }
        return this.attributes.solana
    }
}
/**
 * Compares two currencies for equality
 */
export function tokenEquals(tokenA: Token, tokenB: Token): boolean {
    return tokenA.equals(tokenB)
}


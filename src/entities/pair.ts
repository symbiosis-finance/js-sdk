import { Price, TokenAmount } from './fractions'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { keccak256, pack } from '@ethersproject/solidity'
import { getCreate2Address as getEvmCreate2Address } from '@ethersproject/address'

import {
    _1000,
    _997,
    BigintIsh,
    ChainId,
    FACTORY_ADDRESS,
    FIVE,
    INIT_CODE_HASH,
    MINIMUM_LIQUIDITY,
    ONE,
    ZERO,
} from '../constants'
import { parseBigintIsh, sqrt } from '../utils'
import { getTronCreate2Address, isTronChainId } from '../crosschain/chainUtils/tron'
import { InsufficientInputAmountError, InsufficientReservesError } from '../errors'
import { Token } from './token'
import { BytesLike } from '@ethersproject/bytes'
import { EvmAddress, NonEmptyAddress } from '..'

export class MapWithDefault<K, V> extends Map<K, V> {
    #default: () => V
    get(key: K): V {
        if (!this.has(key)) {
            this.set(key, this.#default())
        }
        return super.get(key) as V
    }

    constructor(defaultFunction: () => V, entries?: readonly (readonly [K, V])[] | null) {
        super(entries)
        this.#default = defaultFunction
    }
}

export const PAIR_ADDRESS_CACHE = new MapWithDefault<NonEmptyAddress, Map<NonEmptyAddress, EvmAddress>>(() => new Map())

// TODO replace with onchain call to Factory.getPair method
export function getZkCreate2Address(from: EvmAddress, salt: BytesLike, initCodeHash: BytesLike): EvmAddress {
    const MAP: Record<EvmAddress, Record<string, EvmAddress>> = {
        '0x50704Ac00064be03CEEd817f41E0Aa61F52ef4DC': {
            '0x10dac1b69a0ef99baf5786f77bf0aab84749fd564007f4fad53a9395afa06d6a':
                '0x20eDB5049461c9a6F490671742824c9F9aD05eD8', // H2 (USDC,wzkCRO)
            '0xdaa80bb10d1689abf76a659ce2e4b2c7e859fca2d05933a3d81c3636c0ef62f0':
                '0x006022eb9de7869e84f021605Ae23bE6C7D2d952', // H2 (USDC,vUSD)
            '0x91965e804433f989e92a043ea20a588fec7c4ca4ce64a380d6215f3992eadbb6':
                '0xA61947027caDbe9505d2a40E73EB21CB957e2daD', // H2 (wzkCRO,vUSD)
        },
    }
    try {
        return MAP[from][salt as string]
    } catch {
        throw new Error(`Unknown zk pair with initCodeHash: ${initCodeHash}`)
    }
}

export class Pair {
    public readonly liquidityToken: Token
    private readonly tokenAmounts: [TokenAmount, TokenAmount]

    public static getAddress(tokenA: Token, tokenB: Token): EvmAddress {
        const tokens = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

        const chainId = tokens[0].chainId

        let types: string[] = ['address', 'address']
        let params: (string | boolean)[] = [tokens[0].address, tokens[1].address]

        if (chainId === ChainId.KAVA_MAINNET) {
            types = [...types, 'bool']
            params = [...params, false]
        }

        if (PAIR_ADDRESS_CACHE.get(tokens[0].address).get(tokens[1].address) === undefined) {
            let getCreate2Address = getEvmCreate2Address as (
                from: EvmAddress,
                salt: BytesLike,
                initCodeHash: BytesLike
            ) => EvmAddress

            if (isTronChainId(chainId)) {
                getCreate2Address = getTronCreate2Address
            } else if (chainId === ChainId.CRONOS_ZK_MAINNET) {
                getCreate2Address = getZkCreate2Address
            }

            PAIR_ADDRESS_CACHE.get(tokens[0].address).set(
                tokens[1].address,
                getCreate2Address(
                    FACTORY_ADDRESS[chainId],
                    keccak256(['bytes'], [pack(types, params)]),
                    INIT_CODE_HASH[chainId]
                )
            )
        }

        return PAIR_ADDRESS_CACHE.get(tokens[0].address).get(tokens[1].address) as EvmAddress
    }

    public constructor(tokenAmountA: TokenAmount, tokenAmountB: TokenAmount) {
        const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
            ? [tokenAmountA, tokenAmountB]
            : [tokenAmountB, tokenAmountA]
        this.liquidityToken = new Token({
            chainId: tokenAmounts[0].token.chainId,
            address: Pair.getAddress(tokenAmounts[0].token, tokenAmounts[1].token),
            decimals: 18,
            symbol: 'UNI-V2',
            name: 'Uniswap V2',
        })
        this.tokenAmounts = tokenAmounts as [TokenAmount, TokenAmount]
    }

    /**
     * Returns true if the token is either token0 or token1
     * @param token to check
     */
    public involvesToken(token: Token): boolean {
        return token.equals(this.token0) || token.equals(this.token1)
    }

    /**
     * Returns the current mid price of the pair in terms of token0, i.e. the ratio of reserve1 to reserve0
     */
    public get token0Price(): Price {
        return new Price(this.token0, this.token1, this.tokenAmounts[0].raw, this.tokenAmounts[1].raw)
    }

    /**
     * Returns the current mid price of the pair in terms of token1, i.e. the ratio of reserve0 to reserve1
     */
    public get token1Price(): Price {
        return new Price(this.token1, this.token0, this.tokenAmounts[1].raw, this.tokenAmounts[0].raw)
    }

    /**
     * Return the price of the given token in terms of the other token in the pair.
     * @param token token to return price of
     */
    public priceOf(token: Token): Price {
        invariant(this.involvesToken(token), 'TOKEN')
        return token.equals(this.token0) ? this.token0Price : this.token1Price
    }

    /**
     * Returns the chain ID of the tokens in the pair.
     */
    public get chainId(): ChainId {
        return this.token0.chainId
    }

    public get token0(): Token {
        return this.tokenAmounts[0].token
    }

    public get token1(): Token {
        return this.tokenAmounts[1].token
    }

    public get reserve0(): TokenAmount {
        return this.tokenAmounts[0]
    }

    public get reserve1(): TokenAmount {
        return this.tokenAmounts[1]
    }

    public reserveOf(token: Token): TokenAmount {
        invariant(this.involvesToken(token), 'TOKEN')
        return token.equals(this.token0) ? this.reserve0 : this.reserve1
    }

    public getOutputAmount(inputAmount: TokenAmount): [TokenAmount, Pair] {
        invariant(this.involvesToken(inputAmount.token), 'TOKEN')
        if (JSBI.equal(this.reserve0.raw, ZERO) || JSBI.equal(this.reserve1.raw, ZERO)) {
            throw new InsufficientReservesError()
        }
        const inputReserve = this.reserveOf(inputAmount.token)
        const outputReserve = this.reserveOf(inputAmount.token.equals(this.token0) ? this.token1 : this.token0)
        const inputAmountWithFee = JSBI.multiply(inputAmount.raw, _997)
        const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.raw)
        const denominator = JSBI.add(JSBI.multiply(inputReserve.raw, _1000), inputAmountWithFee)
        const outputAmount = new TokenAmount(
            inputAmount.token.equals(this.token0) ? this.token1 : this.token0,
            JSBI.divide(numerator, denominator)
        )
        if (JSBI.equal(outputAmount.raw, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return [outputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
    }

    public getInputAmount(outputAmount: TokenAmount): [TokenAmount, Pair] {
        invariant(this.involvesToken(outputAmount.token), 'TOKEN')
        if (
            JSBI.equal(this.reserve0.raw, ZERO) ||
            JSBI.equal(this.reserve1.raw, ZERO) ||
            JSBI.greaterThanOrEqual(outputAmount.raw, this.reserveOf(outputAmount.token).raw)
        ) {
            throw new InsufficientReservesError()
        }

        const outputReserve = this.reserveOf(outputAmount.token)
        const inputReserve = this.reserveOf(outputAmount.token.equals(this.token0) ? this.token1 : this.token0)
        const numerator = JSBI.multiply(JSBI.multiply(inputReserve.raw, outputAmount.raw), _1000)
        const denominator = JSBI.multiply(JSBI.subtract(outputReserve.raw, outputAmount.raw), _997)
        const inputAmount = new TokenAmount(
            outputAmount.token.equals(this.token0) ? this.token1 : this.token0,
            JSBI.add(JSBI.divide(numerator, denominator), ONE)
        )
        return [inputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount))]
    }

    public getLiquidityMinted(
        totalSupply: TokenAmount,
        tokenAmountA: TokenAmount,
        tokenAmountB: TokenAmount
    ): TokenAmount {
        invariant(totalSupply.token.equals(this.liquidityToken), 'LIQUIDITY')
        const tokenAmounts = tokenAmountA.token.sortsBefore(tokenAmountB.token) // does safety checks
            ? [tokenAmountA, tokenAmountB]
            : [tokenAmountB, tokenAmountA]
        invariant(tokenAmounts[0].token.equals(this.token0) && tokenAmounts[1].token.equals(this.token1), 'TOKEN')

        let liquidity: JSBI
        if (JSBI.equal(totalSupply.raw, ZERO)) {
            liquidity = JSBI.subtract(sqrt(JSBI.multiply(tokenAmounts[0].raw, tokenAmounts[1].raw)), MINIMUM_LIQUIDITY)
        } else {
            const amount0 = JSBI.divide(JSBI.multiply(tokenAmounts[0].raw, totalSupply.raw), this.reserve0.raw)
            const amount1 = JSBI.divide(JSBI.multiply(tokenAmounts[1].raw, totalSupply.raw), this.reserve1.raw)
            liquidity = JSBI.lessThanOrEqual(amount0, amount1) ? amount0 : amount1
        }
        if (!JSBI.greaterThan(liquidity, ZERO)) {
            throw new InsufficientInputAmountError()
        }
        return new TokenAmount(this.liquidityToken, liquidity)
    }

    public getLiquidityValue(
        token: Token,
        totalSupply: TokenAmount,
        liquidity: TokenAmount,
        feeOn = false,
        kLast?: BigintIsh
    ): TokenAmount {
        invariant(this.involvesToken(token), 'TOKEN')
        invariant(totalSupply.token.equals(this.liquidityToken), 'TOTAL_SUPPLY')
        invariant(liquidity.token.equals(this.liquidityToken), 'LIQUIDITY')
        invariant(JSBI.lessThanOrEqual(liquidity.raw, totalSupply.raw), 'LIQUIDITY')

        let totalSupplyAdjusted: TokenAmount
        if (!feeOn) {
            totalSupplyAdjusted = totalSupply
        } else {
            invariant(!!kLast, 'K_LAST')
            const kLastParsed = parseBigintIsh(kLast)
            if (!JSBI.equal(kLastParsed, ZERO)) {
                const rootK = sqrt(JSBI.multiply(this.reserve0.raw, this.reserve1.raw))
                const rootKLast = sqrt(kLastParsed)
                if (JSBI.greaterThan(rootK, rootKLast)) {
                    const numerator = JSBI.multiply(totalSupply.raw, JSBI.subtract(rootK, rootKLast))
                    const denominator = JSBI.add(JSBI.multiply(rootK, FIVE), rootKLast)
                    const feeLiquidity = JSBI.divide(numerator, denominator)
                    totalSupplyAdjusted = totalSupply.add(new TokenAmount(this.liquidityToken, feeLiquidity))
                } else {
                    totalSupplyAdjusted = totalSupply
                }
            } else {
                totalSupplyAdjusted = totalSupply
            }
        }

        return new TokenAmount(
            token,
            JSBI.divide(JSBI.multiply(liquidity.raw, this.reserveOf(token).raw), totalSupplyAdjusted.raw)
        )
    }
}

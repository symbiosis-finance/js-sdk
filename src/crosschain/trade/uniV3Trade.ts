import type { Currency, Ether } from '@uniswap/sdk-core'
import {
    CurrencyAmount,
    NativeCurrency,
    Percent as PercentUni,
    Token as TokenUni,
    TradeType,
    validateAndParseAddress,
} from '@uniswap/sdk-core'
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json' with { type: 'json' }
import type { MethodParameters, SwapOptions } from '@uniswap/v3-sdk'
import {
    computePoolAddress,
    encodeRouteToPath,
    FeeAmount,
    Multicall,
    Payments,
    Pool,
    Route,
    SelfPermit,
    SwapQuoter,
    toHex,
    Trade,
} from '@uniswap/v3-sdk'
import { ethers } from 'ethers'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount, WETH } from '../../entities'
import { getMinAmount } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { UniV3Router02__factory } from '../contracts'
import type { IV3SwapRouter } from '../contracts/UniV3Router02'
import { getMulticall } from '../multicall'
import { AggregateSdkError, UniV3TradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

interface Deployment {
    factory: Address
    quoter: Address
    swap02: Address
    initCodeHash?: string
    baseTokens: Token[]
}

const POSSIBLE_FEES = [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]

const DEPLOYMENT_ADDRESSES: Partial<Record<ChainId, Deployment>> = {
    [ChainId.UNICHAIN_MAINNET]: {
        factory: '0x1f98400000000000000000000000000000000003',
        quoter: '0x385a5cf5f83e99f7bb2852b6a19c3538b9fa7658',
        swap02: '0x73855d06de49d0fe4a9c42636ba96c62da12ff9c',
        baseTokens: [
            new Token({
                name: 'USD Coin',
                symbol: 'USDC',
                address: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
                chainId: ChainId.UNICHAIN_MAINNET,
                decimals: 6,
            }),
            WETH[ChainId.UNICHAIN_MAINNET],
        ],
    },
    [ChainId.SONEIUM_MAINNET]: {
        factory: '0x3E4ff8662820E3dec3DACDb66ef1FFad5Dc5Ab83',
        quoter: '0x715BE426a0c8E0A14aBc0130f08F06aa41B1f218',
        swap02: '0xd2DdF58Bcc188F335061e41C73ED2A8894c2dD98',
        baseTokens: [
            new Token({
                name: 'ASTR',
                symbol: 'ASTR',
                address: '0x2CAE934a1e84F693fbb78CA5ED3B0A6893259441',
                chainId: ChainId.SONEIUM_MAINNET,
                decimals: 18,
            }),
            new Token({
                name: 'USD Coin',
                symbol: 'USDC',
                address: '0xbA9986D2381edf1DA03B0B9c1f8b00dc4AacC369',
                chainId: ChainId.SONEIUM_MAINNET,
                decimals: 6,
            }),
            WETH[ChainId.SONEIUM_MAINNET],
        ],
    },
    [ChainId.HYPERLIQUID_MAINNET]: {
        factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3',
        quoter: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        swap02: '0x6D99e7f6747AF2cDbB5164b6DD50e40D4fDe1e77',
        initCodeHash: '0xe3572921be1688dba92df30c6781b8770499ff274d20ae9b325f4242634774fb',
        baseTokens: [WETH[ChainId.HYPERLIQUID_MAINNET]],
    },
    [ChainId.BERACHAIN_MAINNET]: {
        factory: '0xD84CBf0B02636E7f53dB9E5e45A616E05d710990',
        quoter: '0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B',
        swap02: '0xe301E48F77963D3F7DbD2a4796962Bd7f3867Fb4',
        initCodeHash: '0xd8e2091bc519b509176fc39aeb148cc8444418d3ce260820edc44e806c2c2339',
        baseTokens: [WETH[ChainId.BERACHAIN_MAINNET]],
    },
    [ChainId.CITREA_MAINNET]: {
        factory: '0xd809b1285aDd8eeaF1B1566Bf31B2B4C4Bba8e82',
        quoter: '0x428f20dd8926Eabe19653815Ed0BE7D6c36f8425',
        swap02: '0x565eD3D57fe40f78A46f348C220121AE093c3cF8',
        initCodeHash: '0x851d77a45b8b9a205fb9f44cb829cceba85282714d2603d601840640628a3da7',
        baseTokens: [
            WETH[ChainId.CITREA_MAINNET],
            new Token({
                name: 'Symbiosis BTC',
                symbol: 'syBTC',
                address: '0x384157027B1CDEAc4e26e3709667BB28735379Bb',
                chainId: ChainId.CITREA_MAINNET,
                decimals: 8,
            }),
        ],
    },
    // oku.trade
    [ChainId.TELOS_MAINNET]: {
        factory: '0xcb2436774C3e191c85056d248EF4260ce5f27A9D',
        quoter: '0x5911cB3633e764939edc2d92b7e1ad375Bb57649',
        swap02: '0xaa52bB8110fE38D0d2d2AF0B85C3A3eE622CA455',
        // initCodeHash: '',
        baseTokens: [WETH[ChainId.TELOS_MAINNET]],
    },
}

interface UniV3TradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
}

export class UniV3Trade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly deadline: number

    static isSupported(chainId: ChainId): boolean {
        return !!DEPLOYMENT_ADDRESSES[chainId]
    }

    public constructor(params: UniV3TradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.deadline = params.deadline
    }

    get tradeType(): SymbiosisTradeType {
        return SymbiosisTradeType.UNI_V3
    }

    public async init() {
        const chainId = this.tokenAmountIn.token.chainId

        const addresses = DEPLOYMENT_ADDRESSES[chainId]
        if (!addresses) {
            throw new UniV3TradeError('Unsupported chain')
        }
        const provider = this.symbiosis.getProvider(chainId)

        const { quoter, swap02: routerAddress, factory, initCodeHash, baseTokens } = addresses

        const currencyIn = toUniCurrency(this.tokenAmountIn.token)
        const currencyOut = toUniCurrency(this.tokenOut)

        // Step 1: compute all candidate pool addresses
        interface PoolCandidate {
            address: string
            tokenA: typeof currencyIn.wrapped
            tokenB: typeof currencyOut.wrapped
            fee: FeeAmount
        }
        interface MultiHopInfo {
            pool1Index: number
            pool2Index: number
        }

        const candidates: PoolCandidate[] = []
        const multiHops: MultiHopInfo[] = []

        const directCount = POSSIBLE_FEES.length
        for (const fee of POSSIBLE_FEES) {
            candidates.push({
                address: computePoolAddress({
                    factoryAddress: factory,
                    tokenA: currencyIn.wrapped,
                    tokenB: currencyOut.wrapped,
                    fee,
                    initCodeHashManualOverride: initCodeHash,
                }),
                tokenA: currencyIn.wrapped,
                tokenB: currencyOut.wrapped,
                fee,
            })
        }

        for (const baseToken of baseTokens) {
            const baseCurrency = toUniCurrency(baseToken).wrapped
            if (baseCurrency.equals(currencyIn.wrapped) || baseCurrency.equals(currencyOut.wrapped)) {
                continue
            }
            for (const fee of POSSIBLE_FEES) {
                const pool1Index = candidates.length
                candidates.push({
                    address: computePoolAddress({
                        factoryAddress: factory,
                        tokenA: currencyIn.wrapped,
                        tokenB: baseCurrency,
                        fee,
                        initCodeHashManualOverride: initCodeHash,
                    }),
                    tokenA: currencyIn.wrapped,
                    tokenB: baseCurrency,
                    fee,
                })
                const pool2Index = candidates.length
                candidates.push({
                    address: computePoolAddress({
                        factoryAddress: factory,
                        tokenA: baseCurrency,
                        tokenB: currencyOut.wrapped,
                        fee,
                        initCodeHashManualOverride: initCodeHash,
                    }),
                    tokenA: baseCurrency,
                    tokenB: currencyOut.wrapped,
                    fee,
                })
                multiHops.push({ pool1Index, pool2Index })
            }
        }

        // Step 2: batch fetch liquidity + slot0 for all pools via multicall
        const multicall = await getMulticall(provider)
        const poolIface = new ethers.utils.Interface(IUniswapV3PoolABI.abi)

        const poolCalls = candidates.flatMap((c) => [
            { target: c.address, callData: poolIface.encodeFunctionData('liquidity') },
            { target: c.address, callData: poolIface.encodeFunctionData('slot0') },
        ])
        const poolResults = await multicall.callStatic.tryAggregate(false, poolCalls)

        // Step 3: build Pool objects from results
        const pools: (Pool | undefined)[] = candidates.map((candidate, i) => {
            const liquidityResult = poolResults[i * 2]
            const slot0Result = poolResults[i * 2 + 1]

            if (
                !liquidityResult.success ||
                !slot0Result.success ||
                liquidityResult.returnData.length <= 2 ||
                slot0Result.returnData.length <= 2
            )
                return undefined

            const [liquidity] = poolIface.decodeFunctionResult('liquidity', liquidityResult.returnData)
            const slot0 = poolIface.decodeFunctionResult('slot0', slot0Result.returnData)

            if (liquidity.isZero()) return undefined

            const [sorted0, sorted1] = candidate.tokenA.sortsBefore(candidate.tokenB)
                ? [candidate.tokenA, candidate.tokenB]
                : [candidate.tokenB, candidate.tokenA]

            return new Pool(sorted0, sorted1, candidate.fee, slot0[0].toString(), liquidity.toString(), slot0[1])
        })

        // Step 4: build routes
        const routes: Route<Currency, Currency>[] = []

        for (let i = 0; i < directCount; i++) {
            const pool = pools[i]
            if (pool) routes.push(new Route([pool], currencyIn, currencyOut))
        }
        for (const { pool1Index, pool2Index } of multiHops) {
            const pool1 = pools[pool1Index]
            const pool2 = pools[pool2Index]
            if (pool1 && pool2) routes.push(new Route([pool1, pool2], currencyIn, currencyOut))
        }

        if (routes.length === 0) {
            throw new UniV3TradeError('No pools found')
        }

        // Step 5: batch quoter calls via multicall
        const quoterCalls = routes.map((route) => {
            const { calldata } = SwapQuoter.quoteCallParameters(
                route,
                toUniCurrencyAmount(this.tokenAmountIn),
                TradeType.EXACT_INPUT,
                { useQuoterV2: true }
            )
            return { target: quoter, callData: calldata }
        })
        const quoterResults = await multicall.callStatic.tryAggregate(false, quoterCalls)

        // Step 6: pick the best route
        let bestRoute: Route<Currency, Currency> | undefined
        let bestAmountOut: JSBI | undefined
        const errors: UniV3TradeError[] = []

        for (let i = 0; i < quoterResults.length; i++) {
            const [success, returnData] = quoterResults[i]
            if (!success) {
                errors.push(new UniV3TradeError(`Quote failed for route ${i}`))
                continue
            }
            const amountOut = JSBI.BigInt(ethers.utils.defaultAbiCoder.decode(['uint256'], returnData)[0].toString())
            if (!bestAmountOut || JSBI.greaterThan(amountOut, bestAmountOut)) {
                bestAmountOut = amountOut
                bestRoute = routes[i]
            }
        }

        if (!bestAmountOut || !bestRoute) {
            throw new AggregateSdkError(errors, 'UniV3Route not found')
        }

        const amountOut = new TokenAmount(this.tokenOut, bestAmountOut.toString())

        const trade = Trade.createUncheckedTrade({
            route: bestRoute,
            inputAmount: CurrencyAmount.fromRawAmount(currencyIn, this.tokenAmountIn.raw.toString()),
            outputAmount: CurrencyAmount.fromRawAmount(currencyOut, bestAmountOut),
            tradeType: TradeType.EXACT_INPUT,
        })

        const slippageTolerance = new PercentUni(this.slippage, BIPS_BASE)

        const options: SwapOptions = {
            slippageTolerance,
            deadline: this.deadline,
            recipient: this.to,
        }
        const methodParameters = UniV3Trade.swapCallParameters([trade], options, routerAddress)

        const amountOutMinRaw = getMinAmount(this.slippage, bestAmountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        const priceImpact = new Percent(
            JSBI.multiply(trade.priceImpact.numerator, JSBI.BigInt('-1')),
            trade.priceImpact.denominator
        )
        const callData = methodParameters.calldata
        const { amountOffset, minReceivedOffset, minReceivedOffset2 } = UniV3Trade.getOffsets(callData)

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress,
            approveTo: routerAddress,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset: amountOffset,
            minReceivedOffset,
            minReceivedOffset2,
            priceImpact,
        }
        return this
    }

    private static getOffsets(callData: string) {
        const methods = [
            {
                // exactInputSingle
                sigHash: '04e45aaf',
                offset: 4 + 5 * 32,
                minReceivedOffset: 4 + 6 * 32,
                minReceivedOffset2: undefined,
            },
            {
                // exactInput
                sigHash: 'b858183f',
                offset: 4 + 4 * 32,
                minReceivedOffset: 4 + 5 * 32,
                minReceivedOffset2: undefined,
            },
            {
                // multicall
                sigHash: 'ac9650d8',
                offset: 328,
                minReceivedOffset: 360,
                minReceivedOffset2: 488,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        if (method === undefined) {
            throw new UniV3TradeError('Unknown swap method encoded to calldata')
        }

        return {
            amountOffset: method.offset,
            minReceivedOffset: method.minReceivedOffset,
            minReceivedOffset2: method.minReceivedOffset2,
        }
    }

    public static swapCallParameters(
        trades: Trade<Currency, Currency, TradeType> | Trade<Currency, Currency, TradeType>[],
        options: SwapOptions,
        routerAddress: string
    ): MethodParameters {
        if (!Array.isArray(trades)) {
            trades = [trades]
        }

        const sampleTrade = trades[0]
        const tokenIn = sampleTrade.inputAmount.currency.wrapped
        const tokenOut = sampleTrade.outputAmount.currency.wrapped

        // All trades should have the same starting and ending token.
        invariant(
            trades.every((trade) => trade.inputAmount.currency.wrapped.equals(tokenIn)),
            'TOKEN_IN_DIFF'
        )
        invariant(
            trades.every((trade) => trade.outputAmount.currency.wrapped.equals(tokenOut)),
            'TOKEN_OUT_DIFF'
        )

        const calldatas: string[] = []

        const ZERO_IN: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].inputAmount.currency, 0)
        const ZERO_OUT: CurrencyAmount<Currency> = CurrencyAmount.fromRawAmount(trades[0].outputAmount.currency, 0)

        const totalAmountOut: CurrencyAmount<Currency> = trades.reduce(
            (sum, trade) => sum.add(trade.minimumAmountOut(options.slippageTolerance)),
            ZERO_OUT
        )

        // flag for whether a refund needs to happen
        const mustRefund = sampleTrade.inputAmount.currency.isNative && sampleTrade.tradeType === TradeType.EXACT_OUTPUT
        const inputIsNative = sampleTrade.inputAmount.currency.isNative
        // flags for whether funds should be send first to the router
        const outputIsNative = sampleTrade.outputAmount.currency.isNative
        const routerMustCustody = outputIsNative || !!options.fee

        const totalValue: CurrencyAmount<Currency> = inputIsNative
            ? trades.reduce((sum, trade) => sum.add(trade.maximumAmountIn(options.slippageTolerance)), ZERO_IN)
            : ZERO_IN

        // encode permit if necessary
        if (options.inputTokenPermit) {
            invariant(sampleTrade.inputAmount.currency.isToken, 'NON_TOKEN_PERMIT')
            calldatas.push(SelfPermit.encodePermit(sampleTrade.inputAmount.currency, options.inputTokenPermit))
        }

        const recipient: string = validateAndParseAddress(options.recipient)

        for (const trade of trades) {
            for (const { route, inputAmount, outputAmount } of trade.swaps) {
                const amountIn: string = toHex(trade.maximumAmountIn(options.slippageTolerance, inputAmount).quotient)
                const amountOut: string = toHex(
                    trade.minimumAmountOut(options.slippageTolerance, outputAmount).quotient
                )

                // flag for whether the trade is single hop or not
                const singleHop = route.pools.length === 1

                if (singleHop) {
                    if (trade.tradeType === TradeType.EXACT_INPUT) {
                        const exactInputSingleParams: IV3SwapRouter.ExactInputSingleParamsStruct = {
                            tokenIn: route.tokenPath[0].address,
                            tokenOut: route.tokenPath[1].address,
                            fee: route.pools[0].fee,
                            recipient: routerMustCustody ? routerAddress : recipient,
                            amountIn,
                            amountOutMinimum: amountOut,
                            sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0),
                        }

                        calldatas.push(
                            UniV3Router02__factory.createInterface().encodeFunctionData('exactInputSingle', [
                                exactInputSingleParams,
                            ])
                        )
                    } else {
                        const exactOutputSingleParams: IV3SwapRouter.ExactOutputSingleParamsStruct = {
                            tokenIn: route.tokenPath[0].address,
                            tokenOut: route.tokenPath[1].address,
                            fee: route.pools[0].fee,
                            recipient: routerMustCustody ? routerAddress : recipient,
                            amountOut,
                            amountInMaximum: amountIn,
                            sqrtPriceLimitX96: toHex(options.sqrtPriceLimitX96 ?? 0),
                        }

                        calldatas.push(
                            UniV3Router02__factory.createInterface().encodeFunctionData('exactOutputSingle', [
                                exactOutputSingleParams,
                            ])
                        )
                    }
                } else {
                    invariant(options.sqrtPriceLimitX96 === undefined, 'MULTIHOP_PRICE_LIMIT')

                    const path: string = encodeRouteToPath(route, trade.tradeType === TradeType.EXACT_OUTPUT)

                    if (trade.tradeType === TradeType.EXACT_INPUT) {
                        const exactInputParams = {
                            path,
                            recipient: routerMustCustody ? routerAddress : recipient,
                            amountIn,
                            amountOutMinimum: amountOut,
                        }

                        calldatas.push(
                            UniV3Router02__factory.createInterface().encodeFunctionData('exactInput', [
                                exactInputParams,
                            ])
                        )
                    } else {
                        const exactOutputParams = {
                            path,
                            recipient: routerMustCustody ? routerAddress : recipient,
                            amountOut,
                            amountInMaximum: amountIn,
                        }

                        calldatas.push(
                            UniV3Router02__factory.createInterface().encodeFunctionData('exactOutput', [
                                exactOutputParams,
                            ])
                        )
                    }
                }
            }
        }

        // unwrap
        if (routerMustCustody) {
            if (options.fee) {
                if (outputIsNative) {
                    calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient, options.fee))
                } else {
                    calldatas.push(
                        Payments.encodeSweepToken(
                            sampleTrade.outputAmount.currency.wrapped,
                            totalAmountOut.quotient,
                            recipient,
                            options.fee
                        )
                    )
                }
            } else {
                calldatas.push(Payments.encodeUnwrapWETH9(totalAmountOut.quotient, recipient))
            }
        }

        // refund
        if (mustRefund) {
            calldatas.push(Payments.encodeRefundETH())
        }

        return {
            calldata: Multicall.encodeMulticall(calldatas),
            value: toHex(totalValue.quotient),
        }
    }
}

function toUniToken(token: Token): TokenUni {
    return new TokenUni(token.chainId, token.address, token.decimals)
}

function toUniCurrency(token: Token): Currency {
    if (token.isNative) {
        return GasToken.onChain(token.chainId)
    }
    return toUniToken(token)
}

function toUniCurrencyAmount(tokenAmount: TokenAmount): CurrencyAmount<Currency> {
    const currency = toUniCurrency(tokenAmount.token)
    return CurrencyAmount.fromRawAmount(currency, tokenAmount.raw.toString())
}

class GasToken extends NativeCurrency {
    protected constructor(chainId: number) {
        super(chainId, 18, 'GAS', 'GAS')
    }

    public get wrapped(): TokenUni {
        const weth9 = WETH[this.chainId as ChainId]
        invariant(!!weth9, 'WRAPPED')
        return toUniToken(weth9)
    }

    private static _cache: { [chainId: number]: Ether } = {}

    public static onChain(chainId: number): GasToken {
        return this._cache[chainId] ?? (this._cache[chainId] = new GasToken(chainId))
    }

    public equals(other: Currency): boolean {
        return other.isNative && other.chainId === this.chainId
    }
}

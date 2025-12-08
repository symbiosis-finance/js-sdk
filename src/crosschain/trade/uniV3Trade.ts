import type { Currency } from '@uniswap/sdk-core'
import { CurrencyAmount, Percent as PercentUni, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import type { MethodParameters, Pool, SwapOptions } from '@uniswap/v3-sdk'
import { encodeRouteToPath, FeeAmount, Multicall, Payments, Route, SelfPermit, toHex, Trade } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'
import invariant from 'tiny-invariant'

import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { getMinAmount } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { UniV3Factory__factory, UniV3Quoter__factory, UniV3Router02__factory } from '../contracts'
import type { IV3SwapRouter } from '../contracts/UniV3Router02'
import { AggregateSdkError, UniV3TradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'
import { getOutputQuote } from './uniV3Trade/getOutputQuote'
import { getPool } from './uniV3Trade/pool'
import { toUniCurrency, toUniCurrencyAmount } from './uniV3Trade/toUniTypes'

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
            new Token({
                name: 'Wrapped ETH',
                symbol: 'WETH',
                address: '0x4200000000000000000000000000000000000006',
                chainId: ChainId.UNICHAIN_MAINNET,
                decimals: 18,
            }),
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
            new Token({
                name: 'Wrapped ETH',
                symbol: 'WETH',
                address: '0x4200000000000000000000000000000000000006',
                chainId: ChainId.SONEIUM_MAINNET,
                decimals: 18,
            }),
        ],
    },
    [ChainId.HYPERLIQUID_MAINNET]: {
        factory: '0xB1c0fa0B789320044A6F623cFe5eBda9562602E3',
        quoter: '0x03A918028f22D9E1473B7959C927AD7425A45C7C',
        swap02: '0x6D99e7f6747AF2cDbB5164b6DD50e40D4fDe1e77',
        initCodeHash: '0xe3572921be1688dba92df30c6781b8770499ff274d20ae9b325f4242634774fb',
        baseTokens: [
            new Token({
                name: 'Wrapped HYPE',
                symbol: 'WHYPE',
                address: '0x5555555555555555555555555555555555555555',
                chainId: ChainId.HYPERLIQUID_MAINNET,
                decimals: 18,
            }),
        ],
    },
    [ChainId.BERACHAIN_MAINNET]: {
        factory: '0xD84CBf0B02636E7f53dB9E5e45A616E05d710990',
        quoter: '0x644C8D6E501f7C994B74F5ceA96abe65d0BA662B',
        swap02: '0xe301E48F77963D3F7DbD2a4796962Bd7f3867Fb4',
        initCodeHash: '0xd8e2091bc519b509176fc39aeb148cc8444418d3ce260820edc44e806c2c2339',
        baseTokens: [
            new Token({
                name: 'Wrapped BERA',
                symbol: 'WBERA',
                address: '0x6969696969696969696969696969696969696969',
                chainId: ChainId.BERACHAIN_MAINNET,
                decimals: 18,
            }),
        ],
    },
}

interface UniV3TradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
}

export class UniV3Trade extends SymbiosisTrade {
    private readonly symbiosis!: Symbiosis
    private readonly deadline!: number

    static isSupported(chainId: ChainId): boolean {
        return !!DEPLOYMENT_ADDRESSES[chainId]
    }

    public constructor(params: UniV3TradeParams) {
        super(params)
    }

    get tradeType(): SymbiosisTradeType {
        return 'uni-v3'
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

        const factoryContract = UniV3Factory__factory.connect(factory, provider)
        const quoterContract = UniV3Quoter__factory.connect(quoter, provider)

        const routePromises = POSSIBLE_FEES.map(async (fee) => {
            const pool = await getPool(factoryContract, currencyIn.wrapped, currencyOut.wrapped, fee, initCodeHash)
            return new Route([pool], currencyIn, currencyOut)
        })

        const extraRoutePromises = baseTokens
            .map((baseToken) => {
                const baseCurrency = toUniCurrency(baseToken).wrapped
                if (baseCurrency.equals(currencyIn.wrapped) || baseCurrency.equals(currencyOut.wrapped)) {
                    return
                }

                return POSSIBLE_FEES.map(async (baseFee) => {
                    const results = await Promise.allSettled([
                        getPool(factoryContract, currencyIn.wrapped, baseCurrency, baseFee, initCodeHash),
                        getPool(factoryContract, baseCurrency, currencyOut.wrapped, baseFee, initCodeHash),
                    ])
                    const extraPools = results
                        .map((result) => {
                            if (result.status === 'rejected') {
                                return
                            }
                            return result.value
                        })
                        .filter(Boolean) as Pool[]
                    if (extraPools.length < 2) {
                        return
                    }
                    return new Route(extraPools, currencyIn, currencyOut)
                })
            })
            .flat()

        const routesResults = await Promise.allSettled([...routePromises, ...extraRoutePromises])
        const routes = routesResults
            .map((result) => {
                if (result.status === 'rejected') {
                    return
                }
                return result.value
            })
            .filter(Boolean) as Route<Currency, Currency>[]

        const quotaResults = await Promise.allSettled(
            routes.map(async (route) => {
                const quota = await getOutputQuote(quoterContract, toUniCurrencyAmount(this.tokenAmountIn), route)
                return {
                    route,
                    amountOut: JSBI.BigInt(quota.toString()),
                }
            })
        )

        let bestRoute: Route<Currency, Currency> | undefined = undefined
        let bestAmountOut: JSBI | undefined = undefined
        const errors: UniV3TradeError[] = []
        for (const result of quotaResults) {
            if (result.status === 'rejected') {
                errors.push(new UniV3TradeError(JSON.stringify(result.reason?.toString())))
                continue
            }

            if (!result.value) {
                continue
            }

            const { amountOut, route } = result.value
            if (!bestAmountOut || JSBI.greaterThan(amountOut, bestAmountOut)) {
                bestAmountOut = amountOut
                bestRoute = route
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

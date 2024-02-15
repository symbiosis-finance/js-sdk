import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount, wrappedAmount, wrappedToken } from '../../entities'
import { UniV3Factory__factory, UniV3Quoter__factory, UniV3Router__factory } from '../contracts'
import { Symbiosis } from '../symbiosis'
import type { SymbiosisTrade } from './symbiosisTrade'
import {
    // ADDRESS_ZERO,
    encodeRouteToPath,
    FeeAmount,
    MethodParameters,
    Multicall,
    Payments,
    Route,
    SelfPermit,
    SwapOptions,
    toHex,
    Trade,
} from '@uniswap/v3-sdk'
import { getPool } from './uniV3Trade/pool'
import { Currency, CurrencyAmount, Percent as PercentUni, TradeType, validateAndParseAddress } from '@uniswap/sdk-core'
import { getOutputQuote } from './uniV3Trade/getOutputQuote'
import JSBI from 'jsbi'
import { toUniCurrency, toUniToken } from './uniV3Trade/toUniTypes'
import invariant from 'tiny-invariant'
import { IV3SwapRouter } from '../contracts/UniV3Router'

interface Deployment {
    factory: string
    quoter: string
    swap: string
    baseTokens: Token[]
}

interface UniV3TradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    slippage: number
    ttl: number
    to: string
}

// const POSSIBLE_FEES = [
//     FeeAmount.LOWEST,
//     FeeAmount.LOW,
//     FeeAmount.MEDIUM,
//     FeeAmount.HIGH
// ]

const DEPLOYMENT_ADDRESSES: Partial<Record<ChainId, Deployment>> = {
    [ChainId.RSK_MAINNET]: {
        factory: '0xaF37EC98A00FD63689CF3060BF3B6784E00caD82',
        quoter: '0xb51727c996C68E60F598A923a5006853cd2fEB31',
        swap: '0x0B14ff67f0014046b4b99057Aec4509640b3947A',
        baseTokens: [
            new Token({
                name: 'Tether USD',
                symbol: 'rUSDT',
                address: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
                chainId: ChainId.RSK_MAINNET,
                decimals: 18,
            }),
        ],
    },
}

export class UniV3Trade implements SymbiosisTrade {
    tradeType = 'uni-v3' as const

    public priceImpact: Percent = new Percent('0', '100')
    private readonly symbiosis: Symbiosis
    public readonly tokenAmountIn: TokenAmount
    private readonly tokenOut: Token
    private readonly slippage: number
    private readonly ttl: number
    private readonly to: string

    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    static isSupported(chainId: ChainId): boolean {
        return !!DEPLOYMENT_ADDRESSES[chainId]
    }

    public constructor(params: UniV3TradeParams) {
        const { symbiosis, tokenAmountIn, tokenOut, slippage, ttl, to } = params

        this.symbiosis = symbiosis
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.slippage = slippage
        this.ttl = ttl
        this.to = to
    }

    public async init() {
        const chainId = this.tokenAmountIn.token.chainId

        const addresses = DEPLOYMENT_ADDRESSES[chainId]
        if (!addresses) {
            throw new Error('Unsupported chain')
        }
        const provider = this.symbiosis.getProvider(chainId)

        const { quoter, swap, factory } = addresses

        const tokenIn = toUniToken(wrappedToken(this.tokenAmountIn.token))
        const tokenOut = toUniToken(wrappedToken(this.tokenOut))

        const factoryContract = UniV3Factory__factory.connect(factory, provider)
        const pool = await getPool(factoryContract, tokenIn, tokenOut, FeeAmount.LOW)

        const swapRoute = new Route([pool], tokenIn, tokenOut)

        const quoterContract = UniV3Quoter__factory.connect(quoter, provider)

        const amountOut = await getOutputQuote(quoterContract, wrappedAmount(this.tokenAmountIn), swapRoute)
        this.amountOut = new TokenAmount(this.tokenOut, amountOut.toString())
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOut.toString())

        const currencyIn = toUniCurrency(this.tokenAmountIn.token)
        const currencyOut = toUniCurrency(this.tokenOut)
        const trade = Trade.createUncheckedTrade({
            route: swapRoute,
            inputAmount: CurrencyAmount.fromRawAmount(currencyIn, this.tokenAmountIn.raw.toString()),
            outputAmount: CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountOut)),
            tradeType: TradeType.EXACT_INPUT,
        })

        const options: SwapOptions = {
            slippageTolerance: new PercentUni(this.slippage.toString(), '10000'),
            deadline: Math.floor(Date.now() / 1000) + this.ttl, // 20 minutes from the current Unix time
            recipient: this.to,
        }
        const methodParameters = UniV3Trade.swapCallParameters([trade], options, swap)

        // FIXME
        // this.priceImpact = new Percent(trade.priceImpact.numerator, trade.priceImpact.denominator)
        this.callDataOffset = UniV3Trade.getOffset(methodParameters.calldata)
        this.routerAddress = swap
        this.callData = methodParameters.calldata
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        console.log('this.callDataOffset', this.callDataOffset)
        return this
    }

    private static getOffset(callData: string) {
        const methods = [
            {
                // exactInputSingle
                sigHash: '04e45aaf',
                offset: 4 + 5 * 32,
            },
            {
                // multicall
                sigHash: 'ac9650d8',
                offset: 328,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        return method?.offset
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
                            UniV3Router__factory.createInterface().encodeFunctionData('exactInputSingle', [
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
                            UniV3Router__factory.createInterface().encodeFunctionData('exactOutputSingle', [
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
                            UniV3Router__factory.createInterface().encodeFunctionData('exactInput', [exactInputParams])
                        )
                    } else {
                        const exactOutputParams = {
                            path,
                            recipient: routerMustCustody ? routerAddress : recipient,
                            amountOut,
                            amountInMaximum: amountIn,
                        }

                        calldatas.push(
                            UniV3Router__factory.createInterface().encodeFunctionData('exactOutput', [
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

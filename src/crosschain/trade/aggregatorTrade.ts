import { utils } from 'ethers'
import invariant from 'tiny-invariant'

import type { Percent, Token, TokenAmount } from '../../entities'
import { AggregateSdkError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address, FeeItem } from '../types'
import { IzumiTrade } from './izumiTrade'
import type { OneInchProtocols } from './oneInchTrade'
import { OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'
import { UniV2Trade } from './uniV2Trade'
import { UniV3Trade } from './uniV3Trade'
import { withTracing } from '../tracing'

type Trade = OneInchTrade | OpenOceanTrade | IzumiTrade | UniV2Trade | UniV3Trade

export interface AggregatorTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    clientId: string
    deadline: number // epoch
    preferOneInchUsage?: boolean
    oneInchProtocols?: OneInchProtocols
    firstTimeoutMs?: number // stop waiting for other quotes after this timeout if at least a single quote is available.
}

class TradeNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Trade is not initialized: ${msg}`)
    }
}

class Trades {
    trades: Trade[] = []
    errors: Error[] = []
    tradesCount: number = 0
    startTime: number = Date.now()
    prom: Promise<Trade>
    resolve!: (trade: Trade) => void
    reject!: (err: Error) => void

    constructor(
        private firstTimeoutMs: number | undefined,
        private onError: (provider: string, err: Error) => void
    ) {
        this.prom = new Promise((resolve, reject) => {
            this.resolve = resolve
            this.reject = reject
        })
    }

    push(trade: Promise<Trade>, provider: string) {
        this.tradesCount++
        withTimeout(trade, provider)
            .then(this.success.bind(this))
            .catch((err) => {
                this.onError(provider, err)
                this.fail(err)
            })
    }

    success(trade: Trade) {
        this.trades.push(trade)
        this.check()
    }

    fail(error: Error) {
        this.errors.push(error)
        this.check()
    }

    check() {
        const diff = Date.now() - this.startTime
        const allTradesFinished = this.trades.length + this.errors.length === this.tradesCount

        if (allTradesFinished) {
            if (this.trades.length === 0) {
                this.reject(new AggregateSdkError(this.errors, `AggregatorTrade: all trades failed`))
            } else {
                this.resolve(this.selectTheBestTrade())
            }
        } else if (diff >= (this.firstTimeoutMs || 200)) {
            const oneInch = this.trades.find((trade) => trade.constructor.name === OneInchTrade.name)
            const openOcean = this.trades.find((trade) => trade.constructor.name === OpenOceanTrade.name)

            if (oneInch || openOcean) {
                this.resolve(this.selectTheBestTrade())
            }
        }
    }

    private selectTheBestTrade(): Trade {
        invariant(this.trades.length >= 1)
        let bestTrade!: Trade
        for (const trade of this.trades) {
            if (!bestTrade) {
                bestTrade = trade
                continue
            }

            if (trade.amountOut.greaterThan(bestTrade.amountOut)) {
                bestTrade = trade
            }
        }
        return bestTrade
    }

    wait(): Promise<Trade> {
        const intervalId = setInterval(() => this.check(), 50)
        this.prom.finally(() => clearInterval(intervalId))
        return this.prom
    }
}

function withTimeout<T>(promise: Promise<T>, name: string, timeout: number = 30_000 /* 30 seconds */): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout: ${name}`))
        }, timeout)
        promise
            .then((res) => {
                clearTimeout(timer)
                resolve(res)
            })
            .catch((err) => {
                clearTimeout(timer)
                reject(err)
            })
    })
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface AggregatorTrade extends AggregatorTradeParams {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class AggregatorTrade extends SymbiosisTrade {
    // The best found trade. It is always set after waiting for init().
    protected trade!: Trade

    constructor(private params: AggregatorTradeParams) {
        super(params)
        this.preferOneInchUsage = params.preferOneInchUsage || false
    }

    get tradeType(): SymbiosisTradeType {
        this.assertTradeInitialized('tradeType')
        return this.trade.tradeType
    }

    @withTracing()
    public async init() {
        const { from, slippage, symbiosis, deadline, to, tokenAmountIn, tokenAmountInMin, tokenOut, oneInchProtocols } =
            this.params

        const trades = new Trades(this.firstTimeoutMs, (provider: string, e: Error) => {
            symbiosis.trackAggregatorError({
                provider,
                reason: e.message,
                chain_id: String(tokenOut.chain?.id),
            })
        })

        const clientId = utils.parseBytes32String(symbiosis.clientId)
        const isOneInchClient = clientId === '1inch'
        const isOpenOceanClient = clientId === 'openocean'
        const isOtherClient = !isOneInchClient && !isOpenOceanClient

        const isOneInchAvailable = OneInchTrade.isAvailable(tokenAmountIn.token.chainId) && !isOpenOceanClient

        let isOpenOceanAvailable = OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId) && !isOneInchClient
        if (this.preferOneInchUsage && isOneInchAvailable) {
            isOpenOceanAvailable = false
        }

        if (isOneInchAvailable) {
            const oneInchTrade = new OneInchTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                from,
                to,
                slippage,
                protocols: oneInchProtocols,
            })
            trades.push(oneInchTrade.init(), '1inch')
        }

        if (isOpenOceanAvailable) {
            const openOceanTrade = new OpenOceanTrade({
                symbiosis,
                to,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
            })

            trades.push(openOceanTrade.init(), 'OpenOcean')
        }

        if (isOtherClient && IzumiTrade.isSupported(tokenAmountIn.token.chainId)) {
            const izumiTrade = new IzumiTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                deadline,
                to,
            })
            trades.push(izumiTrade.init(), 'Izumi')
        }

        if (isOtherClient && UniV3Trade.isSupported(tokenAmountIn.token.chainId)) {
            const uniV3Trade = new UniV3Trade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                deadline,
                to,
            })
            trades.push(uniV3Trade.init(), 'UniV3')
        }

        if (isOtherClient && UniV2Trade.isSupported(symbiosis, tokenAmountIn.token.chainId)) {
            const uniV2Trade = new UniV2Trade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
                slippage,
                deadline,
            })
            trades.push(uniV2Trade.init(), 'UniV2')
        }

        this.trade = await trades.wait()

        return this
    }

    get amountOut(): TokenAmount {
        this.assertTradeInitialized('amountOut')
        return this.trade.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertTradeInitialized('amountOutMin')
        return this.trade.amountOutMin
    }

    get routerAddress(): Address {
        this.assertTradeInitialized('routerAddress')
        return this.trade.routerAddress
    }

    get route(): Token[] {
        this.assertTradeInitialized('route')
        return this.trade.route
    }

    get callData(): string {
        this.assertTradeInitialized('callData')
        return this.trade.callData
    }

    get callDataOffset(): number {
        this.assertTradeInitialized('callDataOffset')
        return this.trade.callDataOffset
    }

    get minReceivedOffset(): number {
        this.assertTradeInitialized('minReceivedOffset')
        return this.trade.minReceivedOffset
    }

    get priceImpact(): Percent {
        this.assertTradeInitialized('priceImpact')
        return this.trade.priceImpact
    }

    // Needed only for Tron.
    get functionSelector(): string | undefined {
        this.assertTradeInitialized('functionSelector')
        return this.trade.functionSelector
    }

    public async applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount) {
        this.assertTradeInitialized('applyAmountIn')
        this.trade.applyAmountIn(newAmountIn, newAmountInMin)
        this.tokenAmountIn = newAmountIn
        this.tokenAmountInMin = newAmountInMin
    }

    get fees(): FeeItem[] | undefined {
        this.assertTradeInitialized('fees')
        return this.trade.fees
    }

    private assertTradeInitialized(msg?: string): asserts this is {
        trade: Trade
    } {
        if (!this.trade) {
            throw new TradeNotInitializedError(msg)
        }
    }
}

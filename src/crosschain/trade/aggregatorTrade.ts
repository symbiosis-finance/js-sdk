import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { IzumiTrade } from './izumiTrade'
import { UniV2Trade } from './uniV2Trade'
import { UniV3Trade } from './uniV3Trade'
import { Percent, Token, TokenAmount } from '../../entities'
import { utils } from 'ethers'
import { Address, FeeItem } from '../types'
import { AggregateSdkError } from '../sdkError'

type Trade = OneInchTrade | OpenOceanTrade | IzumiTrade | UniV2Trade | UniV3Trade

interface AggregatorTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    clientId: string
    deadline: number // epoch
    preferOneInchUsage?: boolean
    oneInchProtocols?: OneInchProtocols
}

class TradeNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Trade is not initialized: ${msg}`)
    }
}

export class AggregatorTrade extends SymbiosisTrade {
    protected trade: Trade | undefined
    protected preferOneInchUsage: boolean

    constructor(private params: AggregatorTradeParams) {
        super(params)
        this.preferOneInchUsage = params.preferOneInchUsage || false
    }

    get tradeType(): SymbiosisTradeType {
        this.assertTradeInitialized('tradeType')
        return this.trade.tradeType
    }

    public async init() {
        const { from, slippage, symbiosis, deadline, to, tokenAmountIn, tokenAmountInMin, tokenOut, oneInchProtocols } =
            this.params

        const trades: (Trade | undefined)[] = []
        const errors: Error[] = []

        function successTrade(trade: Trade) {
            trades.push(trade)
        }

        function failTrade(e: Error) {
            trades.push(undefined)
            errors.push(e)
        }

        const clientId = utils.parseBytes32String(symbiosis.clientId)
        const isOneInchClient = clientId === '1inch'
        const isOpenOceanClient = clientId === 'openocean'
        const isOtherClient = !isOneInchClient && !isOpenOceanClient

        const isOneInchAvailable = OneInchTrade.isAvailable(tokenAmountIn.token.chainId) && !isOpenOceanClient

        let isOpenOceanAvailable = OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId) && !isOneInchClient
        if (this.preferOneInchUsage && isOneInchAvailable) {
            isOpenOceanAvailable = false
        }

        const timeout = 30000 // 30s
        const withTimeout = <T>(promise: Promise<T>, name: string): Promise<T> => {
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

        let tradesCount = 0
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

            tradesCount += 1
            withTimeout(oneInchTrade.init(), '1inch')
                .then(successTrade)
                .catch((e: Error) => {
                    symbiosis.trackAggregatorError({
                        provider: '1inch',
                        reason: e.message,
                        chain_id: String(tokenOut.chain?.id),
                    })
                    failTrade(e)
                })
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

            tradesCount += 1
            withTimeout(openOceanTrade.init(), 'OpenOcean')
                .then(successTrade)
                .catch((e: Error) => {
                    symbiosis.trackAggregatorError({
                        provider: 'OpenOcean',
                        reason: e.message,
                        chain_id: String(tokenOut.chain?.id),
                    })
                    failTrade(e)
                })
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
            tradesCount += 1
            withTimeout(izumiTrade.init(), 'Izumi').then(successTrade).catch(failTrade)
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
            tradesCount += 1
            withTimeout(uniV3Trade.init(), 'UniV3').then(successTrade).catch(failTrade)
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

            tradesCount += 1
            withTimeout(uniV2Trade.init(), 'UniV2').then(successTrade).catch(failTrade)
        }

        this.trade = await new Promise((resolve, reject) => {
            const startTime = Date.now()
            const intervalId = setInterval(() => {
                const diff = Date.now() - startTime
                const allTradesFinished = trades.length === tradesCount
                const successTrades: Trade[] = trades.filter(Boolean) as Trade[]

                if (allTradesFinished) {
                    const theBestTrade = this.selectTheBestTrade(successTrades)
                    if (theBestTrade) {
                        resolve(theBestTrade)
                    } else {
                        reject(new AggregateSdkError(errors, `AggregatorTrade: all trades failed`))
                    }
                    clearInterval(intervalId)
                    return
                } else if (diff >= 200) {
                    const oneInch = successTrades.find((trade) => trade.constructor.name === OneInchTrade.name)
                    const openOcean = successTrades.find((trade) => trade.constructor.name === OpenOceanTrade.name)

                    if (oneInch || openOcean) {
                        resolve(this.selectTheBestTrade(successTrades))
                        clearInterval(intervalId)
                    }
                }
            }, 50)
        })

        return this
    }

    private selectTheBestTrade(trades: Trade[]) {
        let bestTrade: Trade | undefined = undefined
        for (const trade of trades) {
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

    get functionSelector(): string | undefined {
        this.assertTradeInitialized('functionSelector')
        return this.trade.functionSelector
    }

    public applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount) {
        this.assertTradeInitialized('applyAmountIn')
        this.trade.applyAmountIn(newAmountIn, newAmountInMin)
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

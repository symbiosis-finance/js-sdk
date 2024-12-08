import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { IzumiTrade } from './izumiTrade'
import { UniV2Trade } from './uniV2Trade'
import { UniV3Trade } from './uniV3Trade'
import { Percent, Token, TokenAmount } from '../../entities'

type Trade = OneInchTrade | OpenOceanTrade | IzumiTrade | UniV2Trade | UniV3Trade

function timeLimitPromise<T>(name: string): Promise<T> {
    return new Promise((_resolve, reject) => {
        setTimeout(() => {
            reject(new Error(`timeLimitPromise: ${name}`))
        }, 2000)
    })
}

async function timeLimited<T>(name: string, fn: Promise<T>): Promise<T> {
    return Promise.race([fn, timeLimitPromise<T>(name)])
}

interface AggregatorTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    dataProvider: DataProvider
    from: string
    clientId: string
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

class TradeNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Trade is not initialized: ${msg}`)
    }
}

export class AggregatorTrade extends SymbiosisTrade {
    protected trade: Trade | undefined

    constructor(private params: AggregatorTradeParams) {
        super(params)
    }

    get tradeType(): SymbiosisTradeType {
        this.assertTradeInitialized('tradeType')
        return this.trade.tradeType
    }

    public async init() {
        const { dataProvider, from, slippage, symbiosis, deadline, to, tokenAmountIn, tokenOut, oneInchProtocols } =
            this.params

        const trades: Trade[] = []

        if (OneInchTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const oracle = symbiosis.oneInchOracle(this.params.tokenAmountIn.token.chainId)
            const oneInchTrade = new OneInchTrade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage,
                oracle,
                dataProvider,
                protocols: oneInchProtocols,
            })

            timeLimited('1inch', oneInchTrade.init()).then(trades.push).catch(console.error)
        }

        if (OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const openOceanTrade = new OpenOceanTrade({
                symbiosis,
                to,
                tokenAmountIn,
                tokenOut,
                slippage,
            })

            timeLimited('OpenOcean', openOceanTrade.init()).then(trades.push).catch(console.error)
        }

        if (IzumiTrade.isSupported(tokenAmountIn.token.chainId)) {
            const izumiTrade = new IzumiTrade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                slippage,
                deadline,
                to,
            })
            timeLimited('izumi', izumiTrade.init()).then(trades.push).catch(console.error)
        }

        if (UniV3Trade.isSupported(tokenAmountIn.token.chainId)) {
            const uniV3Trade = new UniV3Trade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                slippage,
                deadline,
                to,
            })
            timeLimited('UniV3', uniV3Trade.init()).then(trades.push).catch(console.error)
        }

        if (UniV2Trade.isSupported(symbiosis, tokenAmountIn.token.chainId)) {
            const uniV2Trade = new UniV2Trade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                to,
                slippage,
                deadline,
            })

            timeLimited('UniV2', uniV2Trade.init()).then(trades.push).catch(console.error)
        }
        this.trade = await new Promise((resolve, reject) => {
            const startTime = Date.now()
            const intervalId = setInterval(() => {
                console.log('tick 50')
                if (Date.now() - startTime < 500) {
                    return
                }

                const oneInch = trades.find((trade) => trade.constructor.name === OneInchTrade.name)
                const openOcean = trades.find((trade) => trade.constructor.name === OpenOceanTrade.name)

                if (oneInch || openOcean) {
                    console.log('oneInch || openOcean', trades)
                    resolve(this.selectTheBestTrade(trades))
                    clearInterval(intervalId)
                } else {
                    console.log('no', trades.length)
                }
            }, 50)

            setTimeout(() => {
                console.log('timeout', trades)
                const bestTrade = this.selectTheBestTrade(trades)
                if (bestTrade) {
                    resolve(bestTrade)
                } else {
                    reject()
                }
                clearInterval(intervalId)
            }, 2000)
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

    get routerAddress(): string {
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

    public applyAmountIn(newAmount: TokenAmount) {
        this.assertTradeInitialized('applyAmountIn')
        this.trade.applyAmountIn(newAmount)
    }

    private assertTradeInitialized(msg?: string): asserts this is {
        trade: Trade
    } {
        if (!this.trade) {
            throw new TradeNotInitializedError(msg)
        }
    }
}

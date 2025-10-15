import { Symbiosis } from '../symbiosis.ts'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade.ts'
import { OpenOceanTrade } from './openOceanTrade.ts'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade.ts'
import { IzumiTrade } from './izumiTrade.ts'
import { UniV2Trade } from './uniV2Trade.ts'
import { UniV3Trade } from './uniV3Trade.ts'
import { Percent, Token, TokenAmount } from '../../entities/index.ts'
import { utils } from 'ethers'
import { Address, FeeItem } from '../types.ts'

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
        const { from, slippage, symbiosis, deadline, to, tokenAmountIn, tokenOut, oneInchProtocols } = this.params

        const trades: (Trade | undefined)[] = []
        const errors: Error[] = []

        function successTrade(trade: Trade) {
            trades.push(trade)
        }

        function failTrade(e: Error) {
            trades.push(undefined)
            errors.push(e)
            symbiosis.context?.logger.error(e)
        }

        const clientId = utils.parseBytes32String(symbiosis.clientId)
        const isOneInchClient = clientId === '1inch'
        const isOpenOceanClient = clientId === 'openocean'
        const isOtherClient = !isOneInchClient && !isOpenOceanClient

        const isOneInchAvailable = OneInchTrade.isAvailable(tokenAmountIn.token.chainId) && !isOpenOceanClient
        const isOpenOceanAvailable = OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId) && !isOneInchClient

        let isOneInchUsage = isOneInchAvailable
        let isOpenOceanUsage = isOpenOceanAvailable

        const isSignificantAmount =
            (tokenAmountIn.token.symbol?.includes('USD') && parseFloat(tokenAmountIn.toSignificant()) >= 10000) ||
            (tokenAmountIn.token.symbol?.includes('ETH') && parseFloat(tokenAmountIn.toSignificant()) >= 2.5)

        if (this.preferOneInchUsage && isOneInchAvailable) {
            isOpenOceanUsage = false
        } else if (!isSignificantAmount) {
            // select one of them randomly
            const aggregators: SymbiosisTradeType[] = []
            if (isOneInchAvailable) {
                aggregators.push('1inch')
            }
            if (isOpenOceanAvailable) {
                aggregators.push('open-ocean')
            }
            const i = Math.floor(Math.random() * aggregators.length)

            isOneInchUsage = aggregators[i] === '1inch'
            isOpenOceanUsage = aggregators[i] === 'open-ocean'
        }

        let tradesCount = 0
        if (isOneInchUsage) {
            const oneInchTrade = new OneInchTrade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage,
                protocols: oneInchProtocols,
            })

            tradesCount += 1
            oneInchTrade
                .init()
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

        if (isOpenOceanUsage) {
            const openOceanTrade = new OpenOceanTrade({
                symbiosis,
                to,
                tokenAmountIn,
                tokenOut,
                slippage,
            })

            tradesCount += 1
            openOceanTrade
                .init()
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
                tokenOut,
                slippage,
                deadline,
                to,
            })
            tradesCount += 1
            izumiTrade.init().then(successTrade).catch(failTrade)
        }

        if (isOtherClient && UniV3Trade.isSupported(tokenAmountIn.token.chainId)) {
            const uniV3Trade = new UniV3Trade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                slippage,
                deadline,
                to,
            })
            tradesCount += 1
            uniV3Trade.init().then(successTrade).catch(failTrade)
        }

        if (isOtherClient && UniV2Trade.isSupported(symbiosis, tokenAmountIn.token.chainId)) {
            const uniV2Trade = new UniV2Trade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                to,
                slippage,
                deadline,
            })

            tradesCount += 1
            uniV2Trade.init().then(successTrade).catch(failTrade)
        }

        this.trade = await new Promise((resolve, reject) => {
            const startTime = Date.now()
            const intervalId = setInterval(() => {
                const diff = Date.now() - startTime
                const timeout = diff >= 2000
                const allTradesFinished = trades.length === tradesCount
                const successTrades: Trade[] = trades.filter(Boolean) as Trade[]

                if (allTradesFinished || timeout) {
                    const theBestTrade = this.selectTheBestTrade(successTrades)
                    if (theBestTrade) {
                        resolve(theBestTrade)
                    } else {
                        reject(new AggregateError(errors, 'Aggregator trade failed'))
                    }
                    clearInterval(intervalId)
                    return
                } else if (diff >= 500) {
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

    public applyAmountIn(newAmount: TokenAmount) {
        this.assertTradeInitialized('applyAmountIn')
        this.trade.applyAmountIn(newAmount)
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

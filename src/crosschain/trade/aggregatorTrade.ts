import { utils } from 'ethers'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeType } from './symbiosisTrade'
import { IzumiTrade } from './izumiTrade'

interface AggregatorTradeParams {
    symbiosis: Symbiosis
    dataProvider: DataProvider
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
    slippage: number
    clientId: string
    ttl: number
    oneInchProtocols?: OneInchProtocols
}

class TradeNotInitializedError extends Error {
    constructor() {
        super('Trade is not initialized')
    }
}

const OPEN_OCEAN_CLIENT_ID = utils.formatBytes32String('open-ocean')

type TradeType = OneInchTrade | OpenOceanTrade | IzumiTrade

// Get the best trade from all aggregators
export class AggregatorTrade implements SymbiosisTrade {
    protected trade: TradeType | undefined

    static isAvailable(chainId: ChainId): boolean {
        return (
            OneInchTrade.isAvailable(chainId) || OpenOceanTrade.isAvailable(chainId) || IzumiTrade.isSupported(chainId)
        )
    }

    constructor(private params: AggregatorTradeParams) {}

    public async init() {
        const { dataProvider, from, slippage, symbiosis, to, tokenAmountIn, tokenOut, clientId, ttl } = this.params

        const aggregators: Promise<TradeType>[] = []
        if (clientId !== OPEN_OCEAN_CLIENT_ID && OneInchTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const oracle = symbiosis.oneInchOracle(this.params.tokenAmountIn.token.chainId)
            const oneInchTrade = new OneInchTrade(
                this.params.symbiosis,
                tokenAmountIn,
                tokenOut,
                from,
                to,
                slippage,
                oracle,
                dataProvider,
                this.params.oneInchProtocols
            )

            aggregators.push(oneInchTrade.init())
        }

        if (OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const openOceanTrade = new OpenOceanTrade({
                slippage,
                to,
                tokenAmountIn,
                tokenOut,
                dataProvider,
            })

            const promises: Promise<OpenOceanTrade>[] = [openOceanTrade.init()]
            if (clientId !== OPEN_OCEAN_CLIENT_ID) {
                const limitPromise = new Promise((_resolve, reject) => {
                    setTimeout(() => {
                        reject('Timeout OO')
                    }, 5 * 1000)
                }) as Promise<OpenOceanTrade>
                promises.push(limitPromise)
            }

            aggregators.push(Promise.race(promises))
        }

        if (IzumiTrade.isSupported(tokenAmountIn.token.chainId)) {
            const izumiTrade = new IzumiTrade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                slippage,
                ttl,
                to,
            })
            aggregators.push(izumiTrade.init())
        }

        if (aggregators.length === 0) {
            throw new Error('No aggregators available for this trade. Aggregators count is zero.')
        }

        const tradesResults = await Promise.allSettled(aggregators)

        // Find the best trade with the lowest price impact
        let bestTrade: TradeType | undefined
        for (const trade of tradesResults) {
            if (trade.status === 'rejected') {
                console.log('Rejected. Reason: ', trade.reason)
                continue
            }

            if (!bestTrade) {
                bestTrade = trade.value
                continue
            }

            if (trade.value.amountOut.greaterThan(bestTrade.amountOut)) {
                bestTrade = trade.value
            }
        }

        if (!bestTrade) {
            throw new Error('No aggregators available for this trade. All trades have failed.')
        }

        this.trade = bestTrade

        return this
    }

    private assertTradeInitialized(): asserts this is { trade: OneInchTrade | OpenOceanTrade } {
        if (!this.trade) {
            throw new TradeNotInitializedError()
        }
    }

    /**
     * TODO: Use proxy to avoid code duplication
     */
    get callData(): string {
        this.assertTradeInitialized()
        return this.trade.callData
    }

    get callDataOffset(): number {
        this.assertTradeInitialized()
        return this.trade.callDataOffset || 0
    }

    get tokenAmountIn(): TokenAmount {
        this.assertTradeInitialized()
        return this.trade.tokenAmountIn
    }

    get amountOut(): TokenAmount {
        this.assertTradeInitialized()
        return this.trade.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertTradeInitialized()
        return this.trade.amountOutMin
    }

    get routerAddress(): string {
        this.assertTradeInitialized()
        return this.trade.routerAddress
    }

    get priceImpact(): Percent {
        this.assertTradeInitialized()
        return this.trade.priceImpact
    }

    get route(): Token[] {
        this.assertTradeInitialized()
        return this.trade.route
    }

    get tradeType(): SymbiosisTradeType {
        this.assertTradeInitialized()
        return this.trade.tradeType
    }
}

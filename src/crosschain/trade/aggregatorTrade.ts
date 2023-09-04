import { utils } from 'ethers'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeType } from './symbiosisTrade'

interface AggregatorTradeParams {
    symbiosis: Symbiosis
    dataProvider: DataProvider
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
    slippage: number
    clientId: string
    oneInchProtocols?: OneInchProtocols
}

class TradeNotInitializedError extends Error {
    constructor() {
        super('Trade is not initialized')
    }
}

const OPEN_OCEAN_CLIENT_ID = utils.formatBytes32String('open-ocean')

// Get the best trade from all aggregators
export class AggregatorTrade implements SymbiosisTrade {
    protected trade: OneInchTrade | OpenOceanTrade | undefined

    static isAvailable(chainId: ChainId): boolean {
        return OneInchTrade.isAvailable(chainId) || OpenOceanTrade.isAvailable(chainId)
    }

    constructor(private params: AggregatorTradeParams) {}

    public async init() {
        const { dataProvider, from, slippage, symbiosis, to, tokenAmountIn, tokenOut, clientId } = this.params

        const aggregators: Promise<OneInchTrade | OpenOceanTrade>[] = []
        if (clientId !== OPEN_OCEAN_CLIENT_ID && OneInchTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const oracle = symbiosis.oneInchOracle(this.params.tokenAmountIn.token.chainId)
            const oneInchTrade = new OneInchTrade(
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

        if (aggregators.length === 0) {
            throw new Error('No aggregators available for this trade')
        }

        const tradesResults = await Promise.allSettled(aggregators)

        // Find the best trade with the lowest price impact
        let bestTrade: OneInchTrade | OpenOceanTrade | undefined
        for (const trade of tradesResults) {
            if (trade.status === 'rejected') {
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
            throw new Error('No aggregators available for this trade')
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

import { utils } from 'ethers'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeType } from './symbiosisTrade'
import { IzumiTrade } from './izumiTrade'
import { AdaRouter, AvaxRouter, KavaRouter, UniLikeRouter } from '../contracts'
import { UniLikeTrade } from './uniLikeTrade'

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

type TradeType = OneInchTrade | OpenOceanTrade | IzumiTrade | UniLikeTrade

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
            // If no trade found, fallback to Uniswap like trade
            this.trade = await this.buildUniLikeTrade()
            return this
        }

        const tradesResults = await Promise.allSettled(aggregators)

        // Find the best trade with the lowest price impact
        let bestTrade: TradeType | undefined
        for (const trade of tradesResults) {
            if (trade.status === 'rejected') {
                const stack = trade.reason.stack?.split('\n')

                console.log('Rejected. Reason: ', trade.reason, stack && JSON.stringify(stack))
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
            // If no trade found, fallback to Uniswap like trade
            this.trade = await this.buildUniLikeTrade()
            return this
        }

        this.trade = bestTrade

        return this
    }

    private assertTradeInitialized(): asserts this is { trade: OneInchTrade | OpenOceanTrade } {
        if (!this.trade) {
            throw new TradeNotInitializedError()
        }
    }

    private async buildUniLikeTrade(): Promise<UniLikeTrade> {
        const { symbiosis, tokenAmountIn, tokenOut, to, slippage, ttl } = this.params
        const { chainId } = tokenAmountIn.token
        let routerA: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter = symbiosis.uniLikeRouter(chainId)

        if (chainId === ChainId.AVAX_MAINNET) {
            routerA = symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            routerA = symbiosis.adaRouter(chainId)
        }
        if ([ChainId.KAVA_MAINNET].includes(chainId)) {
            routerA = symbiosis.kavaRouter(chainId)
        }

        const dexFee = symbiosis.dexFee(chainId)
        const trade = new UniLikeTrade(tokenAmountIn, tokenOut, to, slippage, ttl, routerA, dexFee)

        await trade.init()

        return trade
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

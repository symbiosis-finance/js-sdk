import { utils } from 'ethers'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeType } from './symbiosisTrade'
import { IzumiTrade } from './izumiTrade'
import {
    AdaRouter,
    AvaxRouter,
    DragonswapRouter,
    DragonswapRouter__factory,
    KavaRouter,
    KimRouter,
    UniLikeRouter,
} from '../contracts'
import { UniV2Trade } from './uniV2Trade'
import { UniV3Trade } from './uniV3Trade'

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

const OPEN_OCEAN_CLIENT_ID = utils.formatBytes32String('openocean')

type TradeType = OneInchTrade | OpenOceanTrade | IzumiTrade | UniV2Trade | UniV3Trade

function limitOpenOceanPromise() {
    return new Promise((_resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Timeout OO'))
        }, 5 * 1000)
    }) as Promise<OpenOceanTrade>
}

// Get the best trade from all aggregators
export class AggregatorTrade implements SymbiosisTrade {
    protected trade: TradeType | undefined

    static isAvailable(chainId: ChainId): boolean {
        return (
            OneInchTrade.isAvailable(chainId) ||
            OpenOceanTrade.isAvailable(chainId) ||
            IzumiTrade.isSupported(chainId) ||
            UniV3Trade.isSupported(chainId)
        )
    }

    constructor(private params: AggregatorTradeParams) {}

    public async init() {
        const { dataProvider, from, slippage, symbiosis, to, tokenAmountIn, tokenOut, clientId, ttl } = this.params

        const aggregators: Promise<TradeType>[] = []
        if (OneInchTrade.isAvailable(tokenAmountIn.token.chainId)) {
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
                symbiosis,
                slippage,
                to,
                tokenAmountIn,
                tokenOut,
            })

            const promises: Promise<OpenOceanTrade>[] = [openOceanTrade.init()]
            if (clientId !== OPEN_OCEAN_CLIENT_ID) {
                promises.push(limitOpenOceanPromise())
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

        if (UniV3Trade.isSupported(tokenAmountIn.token.chainId)) {
            const uniV3Trade = new UniV3Trade({
                symbiosis,
                tokenAmountIn,
                tokenOut,
                slippage,
                ttl,
                to,
            })
            aggregators.push(uniV3Trade.init())
        }

        aggregators.push(this.buildUniV2Trade())

        const tradesResults = await Promise.allSettled(aggregators)

        // Find the best trade with the lowest price impact
        let bestTrade: TradeType | undefined
        for (const trade of tradesResults) {
            if (trade.status === 'rejected') {
                console.error(`AggregatorTrade rejected: ${JSON.stringify(trade.reason?.toString())}`)
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

        this.trade = bestTrade

        return this
    }

    private assertTradeInitialized(): asserts this is {
        trade: TradeType
    } {
        if (!this.trade) {
            throw new TradeNotInitializedError()
        }
    }

    private async buildUniV2Trade(): Promise<UniV2Trade> {
        const { symbiosis, tokenAmountIn, tokenOut, to, slippage, ttl } = this.params
        const { chainId } = tokenAmountIn.token
        let router: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter | KimRouter | DragonswapRouter =
            symbiosis.uniLikeRouter(chainId)

        if (chainId === ChainId.AVAX_MAINNET) {
            router = symbiosis.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            router = symbiosis.adaRouter(chainId)
        }
        if ([ChainId.KAVA_MAINNET].includes(chainId)) {
            router = symbiosis.kavaRouter(chainId)
        }
        if ([ChainId.MODE_MAINNET].includes(chainId)) {
            router = symbiosis.kimRouter(chainId)
        }
        if ([ChainId.SEI_EVM_MAINNET].includes(chainId)) {
            const address = symbiosis.chainConfig(chainId).router
            const provider = symbiosis.getProvider(chainId)
            router = DragonswapRouter__factory.connect(address, provider)
        }

        const dexFee = symbiosis.dexFee(chainId)
        const trade = new UniV2Trade(tokenAmountIn, tokenOut, to, slippage, ttl, router, dexFee)

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

    get functionSelector(): string | undefined {
        this.assertTradeInitialized()

        if ('functionSelector' in this.trade) {
            return this.trade.functionSelector
        }

        return undefined
    }
}

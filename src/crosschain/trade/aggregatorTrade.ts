import { utils } from 'ethers'
import { ChainId } from '../../constants'
import { DataProvider } from '../dataProvider'
import { Symbiosis } from '../symbiosis'
import { OneInchProtocols, OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import { SymbiosisTrade, SymbiosisTradeParams } from './symbiosisTrade'
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

const OPEN_OCEAN_CLIENT_ID = utils.formatBytes32String('openocean')

type TradeType = OneInchTrade | OpenOceanTrade | IzumiTrade | UniV2Trade | UniV3Trade

function limitOpenOceanPromise() {
    return new Promise((_resolve, reject) => {
        setTimeout(() => {
            reject(new Error('Timeout OO'))
        }, 5 * 1000)
    }) as Promise<OpenOceanTrade>
}

interface AggregatorTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    dataProvider: DataProvider
    from: string
    clientId: string
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

export class AggregatorTrade extends SymbiosisTrade {
    protected trade: TradeType | undefined

    static isAvailable(chainId: ChainId): boolean {
        return (
            OneInchTrade.isAvailable(chainId) ||
            OpenOceanTrade.isAvailable(chainId) ||
            IzumiTrade.isSupported(chainId) ||
            UniV3Trade.isSupported(chainId)
        )
    }

    constructor(private params: AggregatorTradeParams) {
        super(params)
    }

    public async init() {
        const {
            dataProvider,
            from,
            slippage,
            symbiosis,
            deadline,
            to,
            tokenAmountIn,
            tokenOut,
            clientId,
            oneInchProtocols,
        } = this.params

        const aggregators: Promise<TradeType>[] = []
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

            aggregators.push(oneInchTrade.init())
        }

        if (OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId)) {
            const openOceanTrade = new OpenOceanTrade({
                symbiosis,
                to,
                tokenAmountIn,
                tokenOut,
                slippage,
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
                deadline,
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
                deadline,
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

    private async buildUniV2Trade(): Promise<UniV2Trade> {
        const { symbiosis, tokenAmountIn, tokenOut, to, slippage, deadline } = this.params
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
        const trade = new UniV2Trade({
            tokenAmountIn,
            tokenOut,
            to,
            slippage,
            deadline,
            router,
            dexFee,
        })

        await trade.init()

        return trade
    }
}

import { Provider } from '@ethersproject/providers'
import JSBI from 'jsbi'
import { ChainId } from '../../constants'
import { Pair, Percent, Token, TokenAmount, Trade, wrappedToken } from '../../entities'
import { Router } from '../../router'
import { BIPS_BASE } from '../constants'
import {
    AdaRouter,
    AvaxRouter,
    DragonswapRouter,
    KavaRouter,
    KimRouter,
    Pair__factory,
    UniLikeRouter,
} from '../contracts'
import { DataProvider } from '../dataProvider'
import { getMulticall } from '../multicall'
import { computeSlippageAdjustedAmounts, computeTradePriceBreakdown, getAllPairCombinations } from '../chainUtils'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getFunctionSelector } from '../chainUtils/tron'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

interface UniV2TradeParams extends SymbiosisTradeParams {
    router: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter | KimRouter | DragonswapRouter
    dexFee: number
    deadline: number
}

export class UniV2Trade extends SymbiosisTrade {
    public trade!: Trade
    private pairs!: Pair[]

    private readonly router: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter | KimRouter | DragonswapRouter
    private readonly dexFee: number
    private readonly deadline: number

    public constructor(params: UniV2TradeParams) {
        super(params)

        const { router, dexFee, deadline } = params
        this.router = router
        this.dexFee = dexFee
        this.deadline = deadline
    }

    get tradeType(): SymbiosisTradeType {
        return 'uni-v2'
    }

    public async init(dataProvider?: DataProvider) {
        if (this.router.address === AddressZero) {
            throw new Error('Router address is zero')
        }
        if (dataProvider) {
            this.pairs = await dataProvider.getPairs(this.tokenAmountIn.token, this.tokenOut)
        } else {
            this.pairs = await UniV2Trade.getPairs(this.router.provider, this.tokenAmountIn.token, this.tokenOut)
        }

        const [trade] = Trade.bestTradeExactIn(this.pairs, this.tokenAmountIn, this.tokenOut, {
            maxHops: 3,
            maxNumResults: 1,
        })

        if (!trade) {
            throw new Error('Cannot create trade')
        }
        this.trade = trade

        const priceImpact = computeTradePriceBreakdown(this.trade, this.dexFee).priceImpactWithoutFee
        if (!priceImpact) {
            throw new Error('Cannot calculate priceImpact')
        }

        const amountOutMin = computeSlippageAdjustedAmounts(trade, this.slippage).OUTPUT
        if (!amountOutMin) {
            throw new Error('Cannot compute amountOutMin')
        }

        const { data, offset, functionSelector } = this.buildCallData(trade)
        if (!data) {
            throw new Error('Cannot build callData')
        }

        this.out = {
            amountOut: trade.outputAmount,
            amountOutMin,
            routerAddress: this.router.address,
            route: trade.route.path,
            callData: data,
            callDataOffset: offset,
            minReceivedOffset: 0, // TODO
            priceImpact,
            functionSelector,
        }
        return this
    }

    private buildCallData(trade: Trade): { data: string; offset: number; functionSelector: string } {
        const { methodName, args, offset } = Router.swapCallParameters(trade, {
            allowedSlippage: new Percent(JSBI.BigInt(Math.floor(this.slippage)), BIPS_BASE),
            recipient: this.to,
            ttl: this.deadline,
            feeOnTransfer: trade.inputAmount.token.chainId === ChainId.MODE_MAINNET, // kim.exchange has extra param `referrer`
        })

        let method = methodName
        // TODO replace the condition to method mapping
        if (trade.inputAmount.token.chainId === ChainId.AVAX_MAINNET) {
            method = methodName.replace('ETH', 'AVAX')
        } else if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(trade.inputAmount.token.chainId)) {
            method = methodName.replace('ETH', 'ADA')
        } else if ([ChainId.SEI_EVM_MAINNET].includes(trade.inputAmount.token.chainId)) {
            method = methodName.replace('ETH', 'SEI')
        }

        const functionAbi = this.router.interface.getFunction(method)

        return {
            functionSelector: getFunctionSelector(functionAbi),
            data: this.router.interface.encodeFunctionData(method as any, args as any),
            offset,
        }
    }

    static async getPairs(provider: Provider, tokenIn: Token, tokenOut: Token): Promise<Pair[]> {
        const allPairCombinations = getAllPairCombinations(tokenIn, tokenOut)
        return await UniV2Trade.allPairs(provider, allPairCombinations)
    }

    private static async allPairs(provider: Provider, tokens: [Token, Token][]): Promise<Pair[]> {
        const wrappedTokens = tokens.map(([tokenA, tokenB]) => [wrappedToken(tokenA), wrappedToken(tokenB)])

        const multicall = await getMulticall(provider)

        const pairAddresses = wrappedTokens.map(([tokenA, tokenB]) => {
            if (!tokenA || !tokenB) throw new Error()
            if (tokenA.chainId !== tokenB.chainId) throw new Error()
            if (tokenA.equals(tokenB)) throw new Error()

            return Pair.getAddress(tokenA, tokenB)
        })

        const pairInterface = Pair__factory.createInterface()
        const getReservesData = pairInterface.encodeFunctionData('getReserves')

        const calls = pairAddresses.map((pairAddress) => ({
            target: pairAddress,
            callData: getReservesData,
        }))

        const aggregateResult = await multicall.callStatic.tryAggregate(false, calls)

        const validPairs: Map<string, Pair> = new Map()
        aggregateResult.forEach(([success, returnData], i) => {
            if (!success || returnData === '0x') {
                return
            }

            const tokenA = wrappedTokens[i][0]
            const tokenB = wrappedTokens[i][1]

            if (!tokenA || !tokenB || tokenA.equals(tokenB)) {
                return
            }

            const reserve = pairInterface.decodeFunctionResult('getReserves', returnData)
            const { reserve0, reserve1 } = reserve
            const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

            const pair = new Pair(
                new TokenAmount(token0, reserve0.toString()),
                new TokenAmount(token1, reserve1.toString())
            )

            validPairs.set(pair.liquidityToken.address, pair)
        })

        return Array.from(validPairs.values())
    }
}

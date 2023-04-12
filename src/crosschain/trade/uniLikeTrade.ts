import { Provider } from '@ethersproject/providers'
import JSBI from 'jsbi'
import flatMap from 'lodash.flatmap'
import { Pair, Percent, Token, TokenAmount, Trade, wrappedToken } from '../../entities'
import { Router } from '../../router'
import { BASES_TO_CHECK_TRADES_AGAINST, BIPS_BASE, CUSTOM_BASES } from '../constants'
import { AdaRouter, AvaxRouter, KavaRouter, MuteRouter__factory, Pair__factory, UniLikeRouter } from '../contracts'
import { getMulticall } from '../multicall'
import { PairState } from '../types'
import { computeSlippageAdjustedAmounts, computeTradePriceBreakdown } from '../utils'
import { ChainId } from '../../constants'
import { DataProvider } from '../dataProvider'
import { SymbiosisTrade } from './symbiosisTrade'

export class UniLikeTrade implements SymbiosisTrade {
    tradeType = 'dex' as const

    public tokenAmountIn: TokenAmount

    public trade!: Trade
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public routerAddress!: string
    public callDataOffset?: number

    private pairs!: Pair[]

    private readonly tokenOut: Token
    private readonly to: string
    private readonly deadline: number
    private readonly slippage: number
    private readonly router: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter
    private readonly dexFee: number

    public constructor(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        to: string,
        slippage: number,
        deadline: number,
        router: UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter,
        dexFee: number
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
        this.deadline = deadline
        this.router = router
        this.routerAddress = router.address
        this.dexFee = dexFee
    }

    public async init(dataProvider?: DataProvider) {
        if (dataProvider) {
            this.pairs = await dataProvider.getPairs(this.tokenAmountIn.token, this.tokenOut)
        } else {
            this.pairs = await UniLikeTrade.getPairs(this.router.provider, this.tokenAmountIn.token, this.tokenOut)
        }

        const trade = Trade.bestTradeExactIn(this.pairs, this.tokenAmountIn, this.tokenOut, {
            maxHops: 3,
            maxNumResults: 1,
        })[0]
        if (!trade) {
            throw new Error('Cannot create trade')
        }
        this.trade = trade

        const priceImpact = computeTradePriceBreakdown(this.trade, this.dexFee).priceImpactWithoutFee
        if (!priceImpact) {
            throw new Error('Cannot calculate priceImpact')
        }
        this.priceImpact = priceImpact

        this.route = trade.route.path

        const amountOut = computeSlippageAdjustedAmounts(trade, this.slippage).OUTPUT
        if (!amountOut) {
            throw new Error('Cannot compute amountOut')
        }
        this.amountOut = amountOut

        const { data, offset } = this.buildCallData(trade)
        this.callData = data
        this.callDataOffset = offset

        if (!this.callData) {
            throw new Error('Cannot build callData')
        }

        return this
    }

    private buildCallData(trade: Trade): { data: string; offset: number } {
        const { methodName, args, offset } = Router.swapCallParameters(trade, {
            allowedSlippage: new Percent(JSBI.BigInt(Math.floor(this.slippage)), BIPS_BASE),
            recipient: this.to,
            ttl: this.deadline,
        })

        let method = methodName
        // TODO replace if condition to method mapping
        if (trade.inputAmount.token.chainId === ChainId.AVAX_MAINNET) {
            method = methodName.replace('ETH', 'AVAX')
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(trade.inputAmount.token.chainId)) {
            method = methodName.replace('ETH', 'ADA')
        }

        if (trade.inputAmount.token.chainId === ChainId.ZKSYNC_MAINNET) {
            // Mute.io custom router
            const muteRouterInterface = MuteRouter__factory.createInterface()

            const path = (Array.isArray(args[1]) ? args[1] : args[2]) as string[]

            // check if pair is stable using 'stable' view method
            const muteArgs: any = [...args, path.map(() => false)]

            return {
                data: muteRouterInterface.encodeFunctionData(method as any, muteArgs),
                offset,
            }
        }

        return {
            data: this.router.interface.encodeFunctionData(method as any, args as any),
            offset,
        }
    }

    static async getPairs(provider: Provider, tokenIn: Token, tokenOut: Token) {
        const allPairCombinations = UniLikeTrade.allPairCombinations(tokenIn, tokenOut)
        const allPairs = await UniLikeTrade.allPairs(provider, allPairCombinations)

        return Object.values(
            allPairs
                // filter out invalid pairs
                .filter((result): result is [PairState.EXISTS, Pair] =>
                    Boolean(result[0] === PairState.EXISTS && result[1])
                )
                // filter out duplicated pairs
                .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
                    memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
                    return memo
                }, {})
        )
    }

    private static async allPairs(provider: Provider, tokens: [Token, Token][]): Promise<[PairState, Pair | null][]> {
        const wrappedTokens = tokens.map(([tokenA, tokenB]) => [wrappedToken(tokenA), wrappedToken(tokenB)])

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

        const multicall = await getMulticall(provider)
        const aggregateResult = await multicall.callStatic.tryAggregate(false, calls)

        const reserves = aggregateResult.map(([success, returnData]) => {
            if (!success || returnData === '0x') return
            return pairInterface.decodeFunctionResult('getReserves', returnData)
        })

        return reserves.map((reserve, i) => {
            const tokenA = wrappedTokens[i][0]
            const tokenB = wrappedTokens[i][1]

            // if (loading) return [PairState.LOADING, null]
            if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
            if (!reserve) return [PairState.NOT_EXISTS, null]
            const { reserve0, reserve1 } = reserve
            const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
            return [
                PairState.EXISTS,
                new Pair(new TokenAmount(token0, reserve0.toString()), new TokenAmount(token1, reserve1.toString())),
            ]
        })
    }

    private static allPairCombinations(tokenIn: Token, tokenOut: Token): [Token, Token][] {
        const chainId = tokenIn.chainId

        // Base tokens for building intermediary trading routes
        const bases = BASES_TO_CHECK_TRADES_AGAINST[chainId]
        if (!bases) {
            throw new Error('Bases not found')
        }

        // All pairs from base tokens
        const basePairs: [Token, Token][] = flatMap(bases, (base: Token): [Token, Token][] =>
            bases.map((otherBase) => [base, otherBase])
        ).filter(([t0, t1]) => t0.address !== t1.address)

        const [tokenA, tokenB] = [wrappedToken(tokenIn), wrappedToken(tokenOut)]
        if (!tokenA || !tokenB) {
            return []
        }

        return (
            [
                // the direct pair
                [tokenA, tokenB],
                // token A against all bases
                ...bases.map((base): [Token, Token] => [tokenA, base]),
                // token B against all bases
                ...bases.map((base): [Token, Token] => [tokenB, base]),
                // each base against all bases
                ...basePairs,
            ]
                .filter((tokens): tokens is [Token, Token] => Boolean(tokens[0] && tokens[1]))
                .filter(([t0, t1]) => t0.address !== t1.address)
                // This filter will remove all the pairs that are not supported by the CUSTOM_BASES settings
                // This option is currently not used on Pancake swap
                .filter(([t0, t1]) => {
                    if (!chainId) return true
                    const customBases = CUSTOM_BASES[chainId]
                    if (!customBases) return true

                    const customBasesA: Token[] | undefined = customBases[t0.address]
                    const customBasesB: Token[] | undefined = customBases[t1.address]

                    if (!customBasesA && !customBasesB) return true
                    if (customBasesA && !customBasesA.find((base) => t1.equals(base))) return false
                    if (customBasesB && !customBasesB.find((base) => t0.equals(base))) return false

                    return true
                })
        )
    }
}

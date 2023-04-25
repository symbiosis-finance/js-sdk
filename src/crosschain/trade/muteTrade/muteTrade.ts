import JSBI from 'jsbi'
import { ChainId } from '../../../constants'
import { Percent, Token, TokenAmount, Trade } from '../../../entities'
import { Router } from '../../../router'
import { BIPS_BASE } from '../../constants'
import { MuteRouter, MuteRouter__factory, Pair__factory } from '../../contracts'
import { Multicall2 } from '../../contracts/Multicall'
import { getMulticall } from '../../multicall'
import { computeSlippageAdjustedAmounts, computeTradePriceBreakdown, getAllPairCombinations } from '../../utils'
import { SymbiosisTrade } from '../symbiosisTrade'
import { MutePair, isMutePair } from './mutePair'

interface MuteTradeOptions {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
    deadline: number
    dexFee: number
    router: MuteRouter
}

export class MuteTrade implements SymbiosisTrade {
    tradeType = 'dex' as const

    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
    deadline: number
    dexFee: number
    router: MuteRouter
    routerAddress: string

    priceImpact!: Percent
    route!: Token[]
    amountOut!: TokenAmount
    callData!: string
    callDataOffset!: number

    private mutePairs?: MutePair[]
    private trade?: Trade

    constructor({ tokenAmountIn, tokenOut, to, slippage, deadline, dexFee, router }: MuteTradeOptions) {
        if (tokenAmountIn.token.chainId !== ChainId.ZKSYNC_MAINNET || tokenOut.chainId !== ChainId.ZKSYNC_MAINNET) {
            throw new Error('MuteTrade only supports on zkSync Era network')
        }

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
        this.deadline = deadline
        this.dexFee = dexFee
        this.router = router
        this.routerAddress = router.address
    }

    async init(): Promise<this> {
        if (!this.tokenAmountIn.token || !this.tokenOut) {
            throw new Error('tokenAmountIn or tokenOut is not set')
        }

        this.mutePairs = await this.getPairs()

        const [trade] = Trade.bestTradeExactIn(this.mutePairs, this.tokenAmountIn, this.tokenOut, {
            maxHops: 3,
            maxNumResults: 1,
        })

        if (!trade) {
            throw new Error('No trade found')
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

        const muteRouterInterface = MuteRouter__factory.createInterface()

        const muteArgs: any = [
            ...args,
            trade.route.pairs.map((pair) => {
                if (!isMutePair(pair)) {
                    throw new Error('Pair is not MutePair')
                }

                return pair.stable
            }),
        ]

        return {
            data: muteRouterInterface.encodeFunctionData(methodName as any, muteArgs),
            offset,
        }
    }

    private async getPairs(): Promise<MutePair[]> {
        const { provider, address } = this.router

        const pairsCombinations = getAllPairCombinations(this.tokenAmountIn.token, this.tokenOut)

        const muteRouterInterface = MuteRouter__factory.createInterface()

        const pairForCalls: Multicall2.CallStruct[] = []
        for (const [tokenA, tokenB] of pairsCombinations) {
            pairForCalls.push(
                {
                    target: address,
                    callData: muteRouterInterface.encodeFunctionData('pairFor', [
                        tokenA.address,
                        tokenB.address,
                        false, // not stable
                    ]),
                },
                {
                    target: address,
                    callData: muteRouterInterface.encodeFunctionData('pairFor', [
                        tokenA.address,
                        tokenB.address,
                        true, // stable
                    ]),
                }
            )
        }

        const multicall = await getMulticall(provider)

        const pairForResults = await multicall.callStatic.tryAggregate(false, pairForCalls)

        const pairData: {
            poolAddress: string
            stable: boolean
            tokenA: Token
            tokenB: Token
        }[] = []
        pairForResults.forEach(([success, returnData], index) => {
            if (!success || returnData === '0x') {
                return
            }

            const pairIndex = Math.floor(index / 2)
            const [tokenA, tokenB] = pairsCombinations[pairIndex]

            const result = muteRouterInterface.decodeFunctionResult('pairFor', returnData)
            pairData.push({ poolAddress: result.pair, stable: index % 2 === 1, tokenA, tokenB })
        })

        const pairInterface = Pair__factory.createInterface()
        const getReservesData = pairInterface.encodeFunctionData('getReserves')

        const getReservesResult = await multicall.callStatic.tryAggregate(
            false,
            pairData.map((pair) => ({ target: pair.poolAddress, callData: getReservesData }))
        )

        const mutePairsMap: Map<string, MutePair> = new Map()
        getReservesResult.forEach(([success, returnData], i) => {
            if (!success || returnData === '0x') {
                return
            }

            const data = pairData[i]
            const { tokenA, tokenB, poolAddress, stable } = data
            if (!tokenA || !tokenB || tokenA.equals(tokenB)) {
                return
            }

            const reserve = pairInterface.decodeFunctionResult('getReserves', returnData)
            const { reserve0, reserve1 } = reserve
            const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]

            const pair = new MutePair({
                tokenAmountA: new TokenAmount(token0, reserve0.toString()),
                tokenAmountB: new TokenAmount(token1, reserve1.toString()),
                poolAddress,
                stable,
            })

            const key = [token0.address, token1.address].join(':')
            const existingPair = mutePairsMap.get(key)
            if (!existingPair) {
                mutePairsMap.set(key, pair)
                return
            }

            // Get the pair with the highest reserves
            if (existingPair.reserve0.greaterThan(pair.reserve0) && existingPair.reserve1.greaterThan(pair.reserve1)) {
                return
            }

            mutePairsMap.set(key, pair)
        })

        return Array.from(mutePairsMap.values())
    }
}

import { AddressZero } from '@ethersproject/constants/lib/addresses'
import type { Provider } from '@ethersproject/providers'
import JSBI from 'jsbi'

import type { Address } from '..'
import { ChainId } from '../../constants'
import type { Token } from '../../entities'
import { Pair, Percent, TokenAmount, Trade, wrappedToken } from '../../entities'
import { Router } from '../../router'
import { computeSlippageAdjustedAmounts, computeTradePriceBreakdown, getAllPairCombinations } from '../chainUtils'
import { getFunctionSelector } from '../chainUtils/tron'
import { BIPS_BASE } from '../constants'
import type {
    AdaRouter,
    AvaxRouter,
    DragonswapRouter,
    HyperSwapRouter,
    KavaRouter,
    KimRouter,
    UniLikeRouter,
} from '../contracts'
import {
    AdaRouter__factory,
    AvaxRouter__factory,
    DragonswapRouter__factory,
    HyperSwapRouter__factory,
    KavaRouter__factory,
    KimRouter__factory,
    UniV2Pair__factory,
    UniLikeRouter__factory,
} from '../contracts'
import { getMulticall } from '../multicall'
import { UniV2TradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

interface UniV2TradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
}

type UniV2Router = UniLikeRouter | AvaxRouter | AdaRouter | KavaRouter | KimRouter | DragonswapRouter | HyperSwapRouter

export class UniV2Trade extends SymbiosisTrade {
    private router!: UniV2Router

    private readonly symbiosis: Symbiosis
    private readonly deadline: number

    static isSupported(symbiosis: Symbiosis, chainId: ChainId): boolean {
        return symbiosis.chainConfig(chainId).router !== AddressZero
    }

    public constructor(params: UniV2TradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.deadline = params.deadline
    }

    get tradeType(): SymbiosisTradeType {
        return 'uni-v2'
    }

    public async init() {
        const { chainId } = this.tokenAmountIn.token

        let router: UniV2Router = this.uniV2Router(chainId)
        if (chainId === ChainId.AVAX_MAINNET) {
            router = this.avaxRouter(chainId)
        }
        if ([ChainId.MILKOMEDA_DEVNET, ChainId.MILKOMEDA_MAINNET].includes(chainId)) {
            router = this.adaRouter(chainId)
        }
        if ([ChainId.KAVA_MAINNET].includes(chainId)) {
            router = this.kavaRouter(chainId)
        }
        if ([ChainId.MODE_MAINNET].includes(chainId)) {
            router = this.kimRouter(chainId)
        }
        if ([ChainId.HYPERLIQUID_MAINNET].includes(chainId)) {
            router = this.hyperSwapRouter(chainId)
        }
        if ([ChainId.SEI_EVM_MAINNET].includes(chainId)) {
            router = this.dragonSwapRouter(chainId)
        }
        this.router = router

        const pairs = await this.symbiosis.cache.get(
            ['getPairs', chainId.toString(), this.tokenAmountIn.token.address, this.tokenOut.address],
            async () => {
                return UniV2Trade.getPairs(this.router.provider, this.tokenAmountIn.token, this.tokenOut)
            },
            60 // 1 minute
        )

        let trade: Trade
        try {
            const { trades, errors } = Trade.bestTradeExactIn(pairs, this.tokenAmountIn, this.tokenOut, {
                maxHops: 3,
                maxNumResults: 1,
            })
            if (trades.length === 0)
                throw AggregateError(
                    errors,
                    `failed to obtain any trades for ${this.tokenAmountIn} -> ${this.tokenOut}`
                )
            else trade = trades[0]
        } catch (e) {
            throw new UniV2TradeError('bestTradeExactIn failed', e)
        }

        const dexFee = this.symbiosis.dexFee(chainId)

        const priceImpact = computeTradePriceBreakdown(trade, dexFee).priceImpactWithoutFee
        if (!priceImpact) {
            throw new UniV2TradeError('Cannot calculate priceImpact')
        }

        const amountOutMin = computeSlippageAdjustedAmounts(trade, this.slippage).OUTPUT
        if (!amountOutMin) {
            throw new UniV2TradeError('Cannot compute amountOutMin')
        }

        const { data, offset, minReceivedOffset, functionSelector } = this.buildCallData(trade)
        if (!data) {
            throw new UniV2TradeError('Cannot build callData')
        }

        this.out = {
            amountOut: trade.outputAmount,
            amountOutMin,
            routerAddress: this.router.address as Address,
            route: trade.route.path,
            callData: data,
            callDataOffset: offset,
            minReceivedOffset,
            priceImpact,
            functionSelector,
        }
        return this
    }

    private buildCallData(trade: Trade): {
        data: string
        offset: number
        minReceivedOffset: number
        functionSelector: string
    } {
        const { methodName, args, offset, minReceivedOffset } = Router.swapCallParameters(trade, {
            allowedSlippage: new Percent(JSBI.BigInt(Math.floor(this.slippage)), BIPS_BASE),
            recipient: this.to,
            ttl: this.deadline,
            feeOnTransfer: [ChainId.MODE_MAINNET, ChainId.HYPERLIQUID_MAINNET].includes(
                trade.inputAmount.token.chainId
            ),
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
            minReceivedOffset,
        }
    }

    private static async getPairs(provider: Provider, tokenIn: Token, tokenOut: Token): Promise<Pair[]> {
        const allPairCombinations = getAllPairCombinations(tokenIn, tokenOut)
        return await UniV2Trade.allPairs(provider, allPairCombinations)
    }

    private static async allPairs(provider: Provider, tokens: [Token, Token][]): Promise<Pair[]> {
        const wrappedTokens = tokens.map(([tokenA, tokenB]) => [wrappedToken(tokenA), wrappedToken(tokenB)])

        const multicall = await getMulticall(provider)

        const pairAddresses = wrappedTokens.map(([tokenA, tokenB]) => {
            if (!tokenA || !tokenB) {
                throw new UniV2TradeError('tokenA or tokenB is null')
            }
            if (tokenA.chainId !== tokenB.chainId) {
                throw new UniV2TradeError('tokenA and tokenB are not on the same chain')
            }
            if (tokenA.equals(tokenB)) {
                throw new UniV2TradeError('tokenA and tokenB are the same')
            }

            return Pair.getAddress(tokenA, tokenB)
        })

        const pairInterface = UniV2Pair__factory.createInterface()
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

    private uniV2Router(chainId: ChainId): UniLikeRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return UniLikeRouter__factory.connect(address, provider)
    }

    private avaxRouter(chainId: ChainId): AvaxRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return AvaxRouter__factory.connect(address, provider)
    }

    private adaRouter(chainId: ChainId): AdaRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return AdaRouter__factory.connect(address, provider)
    }

    private kavaRouter(chainId: ChainId): KavaRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return KavaRouter__factory.connect(address, provider)
    }

    private kimRouter(chainId: ChainId): KimRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return KimRouter__factory.connect(address, provider)
    }

    private hyperSwapRouter(chainId: ChainId): HyperSwapRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return HyperSwapRouter__factory.connect(address, provider)
    }

    private dragonSwapRouter(chainId: ChainId): DragonswapRouter {
        const { address, provider } = this.getRouterConfig(chainId)
        return DragonswapRouter__factory.connect(address, provider)
    }

    private getRouterConfig(chainId: ChainId) {
        const address = this.symbiosis.chainConfig(chainId).router
        const provider = this.symbiosis.getProvider(chainId)
        return { address, provider }
    }
}

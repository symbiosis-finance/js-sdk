import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { UniV3Factory__factory, UniV3Quoter__factory } from '../contracts'
import { Symbiosis } from '../symbiosis'
import type { SymbiosisTrade } from './symbiosisTrade'
import { FeeAmount, Route, SwapOptions, SwapRouter, Trade } from '@uniswap/v3-sdk'
import { getPool } from './uniV3Trade/pool'
import { CurrencyAmount, Percent as PercentUni, TradeType } from '@uniswap/sdk-core'
import { getOutputQuote } from './uniV3Trade/getOutputQuote'
import JSBI from 'jsbi'
import { toUniToken } from './uniV3Trade/toUniTypes'

interface Deployment {
    factory: string
    quoter: string
    swap: string
    baseTokens: Token[]
}

interface UniV3TradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    slippage: number
    ttl: number
    to: string
}

// const POSSIBLE_FEES = [
//     FeeAmount.LOWEST,
//     FeeAmount.LOW,
//     FeeAmount.MEDIUM,
//     FeeAmount.HIGH
// ]

const DEPLOYMENT_ADDRESSES: Partial<Record<ChainId, Deployment>> = {
    [ChainId.RSK_MAINNET]: {
        factory: '0xaF37EC98A00FD63689CF3060BF3B6784E00caD82',
        quoter: '0xb51727c996C68E60F598A923a5006853cd2fEB31',
        swap: '0x0B14ff67f0014046b4b99057Aec4509640b3947A',
        baseTokens: [
            new Token({
                name: 'Tether USD',
                symbol: 'rUSDT',
                address: '0xef213441a85df4d7acbdae0cf78004e1e486bb96',
                chainId: ChainId.RSK_MAINNET,
                decimals: 18,
            }),
        ],
    },
}

export class UniV3Trade implements SymbiosisTrade {
    tradeType = 'uni-v3' as const

    public priceImpact: Percent = new Percent('0', '100')
    private readonly symbiosis: Symbiosis
    public readonly tokenAmountIn: TokenAmount
    private readonly tokenOut: Token
    private readonly slippage: number
    private readonly ttl: number
    private readonly to: string

    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    static isSupported(chainId: ChainId): boolean {
        return !!DEPLOYMENT_ADDRESSES[chainId]
    }

    public constructor(params: UniV3TradeParams) {
        const { symbiosis, tokenAmountIn, tokenOut, slippage, ttl, to } = params

        this.symbiosis = symbiosis
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.slippage = slippage
        this.ttl = ttl
        this.to = to
    }

    public async init() {
        const chainId = this.tokenAmountIn.token.chainId

        const addresses = DEPLOYMENT_ADDRESSES[chainId]
        if (!addresses) {
            throw new Error('Unsupported chain')
        }
        const provider = this.symbiosis.getProvider(chainId)

        const { quoter, swap, factory } = addresses

        const tokenA = toUniToken(this.tokenAmountIn.token)
        const tokenB = toUniToken(this.tokenOut)

        const factoryContract = UniV3Factory__factory.connect(factory, provider)
        const pool = await getPool(factoryContract, tokenA, tokenB, FeeAmount.LOW)

        const swapRoute = new Route([pool], tokenA, tokenB)

        const quoterContract = UniV3Quoter__factory.connect(quoter, provider)

        const amountOut = await getOutputQuote(quoterContract, this.tokenAmountIn, swapRoute)

        const trade = Trade.createUncheckedTrade({
            route: swapRoute,
            inputAmount: CurrencyAmount.fromRawAmount(tokenA, this.tokenAmountIn.raw.toString()),
            outputAmount: CurrencyAmount.fromRawAmount(tokenB, JSBI.BigInt(amountOut)),
            tradeType: TradeType.EXACT_INPUT,
        })

        const options: SwapOptions = {
            slippageTolerance: new PercentUni(this.slippage.toString(), '10000'),
            deadline: Math.floor(Date.now() / 1000) + this.ttl, // 20 minutes from the current Unix time
            recipient: this.to,
        }
        const methodParameters = SwapRouter.swapCallParameters([trade], options)

        this.callDataOffset = 0
        this.routerAddress = swap
        this.callData = methodParameters.calldata
        this.route = [this.tokenAmountIn.token, this.tokenOut]

        return this
    }
}

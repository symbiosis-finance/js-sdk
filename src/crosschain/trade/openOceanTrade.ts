import fetch from 'isomorphic-unfetch'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { OneInchOracle } from '../contracts'
import { DataProvider } from '../dataProvider'
import { getTradePriceImpact } from './getTradePriceImpact'
import { SymbiosisTrade } from './symbiosisTrade'

interface OpenOceanTradeParams {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
    oracle: OneInchOracle
    dataProvider: DataProvider
}

interface OpenOceanQuote {
    inAmount: string
    outAmount: string
    data: string
}

const OPEN_OCEAN_NETWORKS: Partial<Record<ChainId, string>> = {
    [ChainId.ETH_MAINNET]: 'eth',
    [ChainId.BSC_MAINNET]: 'bsc',
    [ChainId.MATIC_MAINNET]: 'polygon',
    [ChainId.AVAX_MAINNET]: 'avax',
    [ChainId.AURORA_MAINNET]: 'aurora',
    [ChainId.HECO_MAINNET]: 'heco',
}

const OPEN_OCEAN_ADDRESS = '0x6352a56caadc4f1e25cd6c75970fa768a3304e64' as const
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const

export class OpenOceanTrade implements SymbiosisTrade {
    public tradeType = 'open-ocean' as const

    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public routerAddress!: string
    public oracle: OneInchOracle

    private readonly dataProvider: DataProvider
    private readonly tokenOut: Token
    private readonly to: string
    private readonly slippage: number

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(OPEN_OCEAN_NETWORKS).includes(chainId.toString())
    }

    public constructor({ tokenAmountIn, tokenOut, to, slippage, oracle, dataProvider }: OpenOceanTradeParams) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
        this.oracle = oracle
        this.dataProvider = dataProvider
    }

    public async init() {
        const chain = OPEN_OCEAN_NETWORKS[this.tokenAmountIn.token.chainId]
        if (!chain) {
            throw new Error('Unsupported chain')
        }

        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        const url = new URL(`https://open-api.openocean.finance/v3/${chain}/swap_quote`)
        url.searchParams.set('inTokenAddress', fromTokenAddress)
        url.searchParams.set('outTokenAddress', toTokenAddress)
        url.searchParams.set('amount', this.tokenAmountIn.toFixed())
        url.searchParams.set('gasPrice', '5')
        url.searchParams.set('slippage', this.slippage.toString())
        url.searchParams.set('account', this.to)

        const response = await fetch(url.toString())

        const json = await response.json()

        if (!response.ok) {
            throw new Error(`Cannot build OpenOcean trade: ${json}`)
        }

        const { data, outAmount } = json.data as OpenOceanQuote

        this.routerAddress = OPEN_OCEAN_ADDRESS
        this.callData = data
        this.amountOut = new TokenAmount(this.tokenOut, outAmount)
        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.priceImpact = await getTradePriceImpact({
            tokenAmountIn: this.tokenAmountIn,
            tokenAmountOut: this.amountOut,
            oracle: this.oracle,
            dataProvider: this.dataProvider,
        })

        return this
    }
}

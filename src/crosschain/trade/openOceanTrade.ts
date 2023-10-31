import fetch from 'isomorphic-unfetch'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { DataProvider } from '../dataProvider'
import { SymbiosisTrade } from './symbiosisTrade'
import BigNumber from 'bignumber.js'
import { BIPS_BASE } from '../constants'
import { getMinAmount } from '../utils'

interface OpenOceanTradeParams {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
    dataProvider: DataProvider
}

interface OpenOceanQuote {
    to: string
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
    [ChainId.KAVA_MAINNET]: 'kava',
    [ChainId.ARBITRUM_MAINNET]: 'arbitrum',
    [ChainId.OPTIMISM_MAINNET]: 'optimism',
    [ChainId.ZKSYNC_MAINNET]: 'zksync',
    [ChainId.POLYGON_ZK]: 'polygon_zkevm',
    [ChainId.LINEA_MAINNET]: 'linea',
    [ChainId.BASE_MAINNET]: 'base',
    [ChainId.SCROLL_MAINNET]: 'scroll',
}

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const
const BASE_URL = 'https://open-api.openocean.finance/v3'

interface GetPriceImpactParams {
    dataProvider: DataProvider
    tokenAmountIn: TokenAmount
    tokenAmountOut: TokenAmount
}

export class OpenOceanTrade implements SymbiosisTrade {
    public tradeType = 'open-ocean' as const

    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public callDataOffset: number
    public priceImpact!: Percent
    public routerAddress!: string

    private chain?: string
    private endpoint: string

    private readonly dataProvider: DataProvider
    private readonly tokenOut: Token
    private readonly to: string
    private readonly slippage: number

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(OPEN_OCEAN_NETWORKS).includes(chainId.toString())
    }

    public constructor({ tokenAmountIn, tokenOut, to, slippage, dataProvider }: OpenOceanTradeParams) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
        this.dataProvider = dataProvider
        this.callDataOffset = 4 + 8 * 32
        this.endpoint = BASE_URL
    }

    public async init() {
        this.chain = OPEN_OCEAN_NETWORKS[this.tokenAmountIn.token.chainId]
        if (!this.chain) {
            throw new Error('Unsupported chain')
        }
        this.endpoint = `${BASE_URL}/${this.chain}`

        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        const url = new URL(`${this.endpoint}/swap_quote`)
        url.searchParams.set('inTokenAddress', fromTokenAddress)
        url.searchParams.set('outTokenAddress', toTokenAddress)
        url.searchParams.set('amount', this.tokenAmountIn.toFixed())
        url.searchParams.set('gasPrice', '5')
        url.searchParams.set('slippage', (this.slippage / 100).toString())
        url.searchParams.set('account', this.to)
        url.searchParams.set('referrer', '0x3254aE00947e44B7fD03F50b93B9acFEd59F9620')

        const response = await fetch(url.toString())

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Cannot build OpenOcean trade: ${text}`)
        }
        const json = await response.json()

        const { data, outAmount, to } = json.data as OpenOceanQuote

        this.routerAddress = to
        this.callData = data
        this.amountOut = new TokenAmount(this.tokenOut, outAmount)

        const amountOutMinRaw = getMinAmount(this.slippage, outAmount)
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.priceImpact = await this.getPriceImpact({
            tokenAmountIn: this.tokenAmountIn,
            tokenAmountOut: this.amountOut,
            dataProvider: this.dataProvider,
        })

        return this
    }

    private async getPriceImpact({ tokenAmountIn, tokenAmountOut }: GetPriceImpactParams): Promise<Percent> {
        const getTokensResponse = await fetch(`${this.endpoint}/specify_tokenList`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tokens: [tokenAmountIn.token.symbol, tokenAmountOut.token.symbol],
            }),
        })

        if (!getTokensResponse.ok) {
            throw new Error(`Cannot get OpenOcean tokenList`)
        }

        const tokens = await getTokensResponse.json()

        const inPrice = tokens.data.find(
            (token: any) => token.symbol.toLowerCase() === tokenAmountIn.token.symbol?.toLowerCase()
        )?.usd
        const outPrice = tokens.data.find(
            (token: any) => token.symbol.toLowerCase() === tokenAmountOut.token.symbol?.toLowerCase()
        )?.usd

        if (inPrice === undefined || outPrice === undefined) {
            throw new Error(`Cannot find OpenOcean token prices`)
        }

        const spot = outPrice / inPrice

        const outDecimals = new BigNumber(10).pow(tokenAmountOut.token.decimals)
        const inBn = new BigNumber(tokenAmountIn.raw.toString()).multipliedBy(outDecimals)

        const inDecimals = new BigNumber(10).pow(tokenAmountIn.token.decimals)
        const outBn = new BigNumber(tokenAmountOut.raw.toString()).multipliedBy(inDecimals)
        const real = inBn.div(outBn)

        const impact = new BigNumber(1).minus(real.div(spot))

        return new Percent(impact.multipliedBy(BIPS_BASE.toString()).integerValue().toString(), BIPS_BASE)
    }
}

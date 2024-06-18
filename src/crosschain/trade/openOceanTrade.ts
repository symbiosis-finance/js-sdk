import { ChainId, getNativeTokenAddress } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { SymbiosisTrade } from './symbiosisTrade'
import { getMinAmount } from '../utils'
import type { Symbiosis } from '../symbiosis'
import { BIPS_BASE } from '../constants'
import BigNumber from 'bignumber.js'

interface OpenOceanTradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
}

interface OpenOceanQuote {
    to: string
    inAmount: string
    outAmount: string
    data: string
    price_impact: string
}

const OPEN_OCEAN_NETWORKS: Partial<Record<ChainId, string>> = {
    // ---  1inch supported chains
    [ChainId.ETH_MAINNET]: 'eth',
    [ChainId.BSC_MAINNET]: 'bsc',
    [ChainId.ZKSYNC_MAINNET]: 'zksync',
    [ChainId.MATIC_MAINNET]: 'polygon',
    [ChainId.BASE_MAINNET]: 'base',
    [ChainId.AVAX_MAINNET]: 'avax',
    [ChainId.ARBITRUM_MAINNET]: 'arbitrum',
    [ChainId.OPTIMISM_MAINNET]: 'optimism',
    // --- OpenOcean supported only chains
    [ChainId.AURORA_MAINNET]: 'aurora',
    [ChainId.HECO_MAINNET]: 'heco',
    [ChainId.KAVA_MAINNET]: 'kava',
    [ChainId.POLYGON_ZK]: 'polygon_zkevm',
    [ChainId.LINEA_MAINNET]: 'linea',
    [ChainId.SCROLL_MAINNET]: 'scroll',
    [ChainId.MANTLE_MAINNET]: 'mantle',
    [ChainId.MANTA_MAINNET]: 'manta',
    [ChainId.METIS_MAINNET]: 'metis',
    [ChainId.BLAST_MAINNET]: 'blast',
    [ChainId.MODE_MAINNET]: 'mode',
    [ChainId.RSK_MAINNET]: 'rootstock',
    [ChainId.CRONOS_MAINNET]: 'cronos',
    [ChainId.SEI_EVM_MAINNET]: 'sei',
}

const BASE_URL = 'https://open-api.openocean.finance/v3'

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

    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly to: string
    private readonly slippage: number

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(OPEN_OCEAN_NETWORKS).includes(chainId.toString())
    }

    public constructor({ symbiosis, tokenAmountIn, tokenOut, to, slippage }: OpenOceanTradeParams) {
        this.symbiosis = symbiosis

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
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
            fromTokenAddress = getNativeTokenAddress(this.tokenAmountIn.token.chainId)
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = getNativeTokenAddress(this.tokenOut.chainId)
        }

        const url = new URL(`${this.endpoint}/swap_quote`)
        url.searchParams.set('inTokenAddress', fromTokenAddress)
        url.searchParams.set('outTokenAddress', toTokenAddress)
        url.searchParams.set('amount', this.tokenAmountIn.toFixed())
        url.searchParams.set('gasPrice', '5')
        url.searchParams.set('slippage', (this.slippage / 100).toString())
        url.searchParams.set('account', this.to)
        url.searchParams.set('referrer', '0x3254aE00947e44B7fD03F50b93B9acFEd59F9620')

        const response = await this.symbiosis.fetch(url.toString())

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Cannot build OpenOcean trade for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }
        const json = await response.json()

        if (json.code !== 200) {
            throw new Error(
                `Cannot build OpenOcean trade for chain ${this.tokenAmountIn.token.chainId}: ${JSON.stringify(json)}}`
            )
        }

        const { data, outAmount, to, price_impact: priceImpactString } = json.data as OpenOceanQuote

        this.routerAddress = to
        this.callData = data
        this.amountOut = new TokenAmount(this.tokenOut, outAmount)

        const amountOutMinRaw = getMinAmount(this.slippage, outAmount)
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.route = [this.tokenAmountIn.token, this.tokenOut]

        this.priceImpact = this.convertPriceImpact(priceImpactString)

        return this
    }

    private convertPriceImpact(value?: string) {
        if (!value) {
            return new Percent('0')
        }

        const number = new BigNumber(value.split('%')[0])
        if (number.isNaN()) {
            return new Percent('0')
        }

        return new Percent(number.multipliedBy(100).integerValue().toString(), BIPS_BASE)
    }
}

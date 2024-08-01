import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { SymbiosisTrade } from './symbiosisTrade'
import { getMinAmount } from '../utils'
import type { Symbiosis } from '../symbiosis'

interface MagpieTradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    from: string
    to: string
    slippage: number
}

interface MagpieQuoteResponse {
    id: string
    amountOut: string
    magpieAggregatorAddress: string
    fees: [
        {
            type: string
            value: string
        }
    ]
}

interface MagpieTransactionResponse {
    from: string
    to: string
    data: string
    chainId: number
    type: number
    gasLimit: string
    maxFeePerGas: string
    maxPriorityFeePerGas: string
    gasPrice: string
    value: string
}

interface MagpieChain {
    slug: string
    nativeTokenAddress?: string
}

const MAGPIE_NETWORKS: Partial<Record<ChainId, MagpieChain>> = {
    [ChainId.BSC_MAINNET]: {
        slug: 'bsc',
    },
    [ChainId.ETH_MAINNET]: {
        slug: 'ethereum',
    },
    [ChainId.MATIC_MAINNET]: {
        slug: 'polygon',
    },
    [ChainId.AVAX_MAINNET]: {
        slug: 'avalanche',
    },
    [ChainId.ARBITRUM_MAINNET]: {
        slug: 'arbitrum',
    },
    [ChainId.OPTIMISM_MAINNET]: {
        slug: 'optimism',
    },
    [ChainId.POLYGON_ZK]: {
        slug: 'polygonzk',
    },
    [ChainId.BASE_MAINNET]: {
        slug: 'base',
    },
    [ChainId.ZKSYNC_MAINNET]: {
        slug: 'zksync',
    },
    [ChainId.BLAST_MAINNET]: {
        slug: 'blast',
    },
    [ChainId.MANTA_MAINNET]: {
        slug: 'manta',
    },
    [ChainId.SCROLL_MAINNET]: {
        slug: 'scroll',
    },
    [ChainId.TAIKO_MAINNET]: {
        slug: 'taiko',
    },
    [ChainId.METIS_MAINNET]: {
        slug: 'metis',
    },
}

const BASE_URL = 'https://api.magpiefi.xyz'
const MAGPIE_NATIVE = '0x0000000000000000000000000000000000000000'

export class MagpieTrade implements SymbiosisTrade {
    public tradeType = 'magpie' as const

    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public callDataOffset: number
    public priceImpact!: Percent
    public routerAddress!: string

    private chain?: MagpieChain

    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly from: string
    private readonly to: string
    private readonly slippage: number

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(MAGPIE_NETWORKS).includes(chainId.toString())
    }

    public constructor({ symbiosis, tokenAmountIn, tokenOut, from, to, slippage }: MagpieTradeParams) {
        this.symbiosis = symbiosis

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.from = from
        this.slippage = slippage
        this.callDataOffset = 0 // TODO if crosschain will be connected
    }

    public async init() {
        this.chain = MAGPIE_NETWORKS[this.tokenAmountIn.token.chainId]
        if (!this.chain) {
            throw new Error('Unsupported chain')
        }

        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = MAGPIE_NATIVE
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = MAGPIE_NATIVE
        }

        const quote: MagpieQuoteResponse = await this.getQuote(fromTokenAddress, toTokenAddress)
        const tx: MagpieTransactionResponse = await this.getTransaction(quote.id, this.to, this.from)

        this.routerAddress = tx.to
        this.callData = tx.data
        this.amountOut = new TokenAmount(this.tokenOut, quote.amountOut)

        const amountOutMinRaw = getMinAmount(this.slippage, quote.amountOut)
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.route = [this.tokenAmountIn.token, this.tokenOut]

        this.priceImpact = new Percent('0', '100')

        return this
    }

    private async getQuote(fromTokenAddress: string, toTokenAddress: string): Promise<MagpieQuoteResponse> {
        const url = new URL(`${BASE_URL}/aggregator/quote`)
        url.searchParams.set('network', this.chain!.slug)
        url.searchParams.set('fromTokenAddress', fromTokenAddress)
        url.searchParams.set('toTokenAddress', toTokenAddress)
        url.searchParams.set('sellAmount', this.tokenAmountIn.raw.toString())
        url.searchParams.set('slippage', (this.slippage / 10000).toString())

        const quoteResponse = await this.symbiosis.fetch(url.toString())

        if (!quoteResponse.ok) {
            const text = await quoteResponse.text()
            throw new Error(`Cannot build Magpie quote for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }

        return quoteResponse.json()
    }

    private async getTransaction(
        quoteId: string,
        toAddress: string,
        fromAddress: string
    ): Promise<MagpieTransactionResponse> {
        const url = new URL(`${BASE_URL}/aggregator/transaction`)
        url.searchParams.set('quoteId', quoteId)
        url.searchParams.set('toAddress', toAddress)
        url.searchParams.set('fromAddress', fromAddress)
        url.searchParams.set('estimateGas', 'false')

        const response = await this.symbiosis.fetch(url.toString())

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Cannot build Magpie trade for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }

        return response.json()
    }
}

import { ChainId } from '../../constants.ts'
import { Percent, TokenAmount } from '../../entities/index.ts'
import { SymbiosisTrade, SymbiosisTradeParams } from './symbiosisTrade.ts'
import { getMinAmount } from '../chainUtils/index.ts'
import type { Symbiosis } from '../symbiosis.ts'
import { CoinGecko } from '../coingecko/index.ts'
import JSBI from 'jsbi'
import { BIPS_BASE } from '../constants.ts'
import { EvmAddress } from '../types.ts'

interface MagpieQuoteRequest {
    fromTokenAddress: string
    toTokenAddress: string
}

interface MagpieQuoteResponse {
    id: string
    amountOut: string
    magpieAggregatorAddress: string
    fees: [
        {
            type: string
            value: string
        },
    ]
}

interface MagpieTransactionResponse {
    from: EvmAddress
    to: EvmAddress
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

interface MagpieTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
}

export class MagpieTrade extends SymbiosisTrade {
    private readonly chain: MagpieChain
    private readonly symbiosis: Symbiosis
    private readonly from: string

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(MAGPIE_NETWORKS).includes(chainId.toString())
    }

    public constructor(params: MagpieTradeParams) {
        super(params)

        const { symbiosis, from, tokenAmountIn } = params
        this.symbiosis = symbiosis
        this.from = from

        const chain = MAGPIE_NETWORKS[tokenAmountIn.token.chainId]
        if (!chain) {
            throw new Error('Unsupported chain')
        }
        this.chain = chain
    }

    public async init() {
        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = MAGPIE_NATIVE
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = MAGPIE_NATIVE
        }

        const quote: MagpieQuoteResponse = await this.getQuote({
            fromTokenAddress,
            toTokenAddress,
        })
        const tx: MagpieTransactionResponse = await this.getTransaction(quote.id)

        const amountOut = new TokenAmount(this.tokenOut, quote.amountOut)

        const amountOutMinRaw = getMinAmount(this.slippage, quote.amountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)
        const priceImpact = await this.getPriceImpact(this.tokenAmountIn, amountOut)

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: tx.to,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData: tx.data,
            callDataOffset: 0, // TODO
            minReceivedOffset: 0, // TODO
            priceImpact,
        }

        return this
    }

    private async getQuote({ fromTokenAddress, toTokenAddress }: MagpieQuoteRequest): Promise<MagpieQuoteResponse> {
        const url = new URL(`${BASE_URL}/aggregator/quote`)
        url.searchParams.set('network', this.chain!.slug)
        url.searchParams.set('fromTokenAddress', fromTokenAddress)
        url.searchParams.set('toTokenAddress', toTokenAddress)
        url.searchParams.set('sellAmount', this.tokenAmountIn.raw.toString())
        url.searchParams.set('slippage', (this.slippage / 10000).toString())
        url.searchParams.set('fromAddress', this.from)
        url.searchParams.set('toAddress', this.to)
        url.searchParams.set('gasless', 'false')

        const quoteResponse = await this.symbiosis.fetch(url.toString())

        if (!quoteResponse.ok) {
            const text = await quoteResponse.text()
            throw new Error(`Cannot build Magpie quote for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }

        return quoteResponse.json()
    }

    private async getTransaction(quoteId: string): Promise<MagpieTransactionResponse> {
        const url = new URL(`${BASE_URL}/aggregator/transaction`)
        url.searchParams.set('quoteId', quoteId)
        url.searchParams.set('estimateGas', 'false')

        const response = await this.symbiosis.fetch(url.toString())

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Cannot build Magpie trade for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }

        return response.json()
    }

    private async getPriceImpact(tokenAmountIn: TokenAmount, tokenAmountOut: TokenAmount): Promise<Percent> {
        try {
            const coinGecko = this.symbiosis.coinGecko
            const [tokenInPrice, tokenOutPrice] = await Promise.all([
                coinGecko.getTokenPriceCached(tokenAmountIn.token),
                coinGecko.getTokenPriceCached(tokenAmountOut.token),
            ])
            const tokenAmountInUsd = CoinGecko.getTokenAmountUsd(tokenAmountIn, tokenInPrice)
            const tokenAmountOutUsd = CoinGecko.getTokenAmountUsd(tokenAmountOut, tokenOutPrice)

            const impactNumber = -(1 - tokenAmountOutUsd / tokenAmountInUsd)

            return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
        } catch {
            return new Percent('0', BIPS_BASE)
        }
    }
}

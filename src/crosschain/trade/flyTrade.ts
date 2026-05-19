import BigNumber from 'bignumber.js'
import JSBI from 'jsbi'

import { ChainId } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import { BIPS_BASE } from '../constants'
import { CoinGecko } from '../coingecko'
import { FlyTradeError } from '../sdkError'
import { withTracing } from '../tracing'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, TradeProvider } from './symbiosisTrade'

interface FlyTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
}

const FLY_NATIVE_TOKEN = '0x0000000000000000000000000000000000000000'

const CHAIN_ID_TO_FLY_NETWORK = new Map<ChainId, string>([
    [ChainId.ETH_MAINNET, 'ethereum'],
    [ChainId.MATIC_MAINNET, 'polygon'],
    [ChainId.BSC_MAINNET, 'bsc'],
    [ChainId.ARBITRUM_MAINNET, 'arbitrum'],
    [ChainId.OPTIMISM_MAINNET, 'optimism'],
    [ChainId.BASE_MAINNET, 'base'],
    [ChainId.AVAX_MAINNET, 'avalanche'],
    [ChainId.BLAST_MAINNET, 'blast'],
    [ChainId.MANTA_MAINNET, 'manta'],
    [ChainId.SCROLL_MAINNET, 'scroll'],
    [ChainId.ZKSYNC_MAINNET, 'zksync'],
    [ChainId.LINEA_MAINNET, 'linea'],
    [ChainId.SONIC_MAINNET, 'sonic'],
    [ChainId.PLASMA_MAINNET, 'plasma'],
    [ChainId.MONAD_MAINNET, 'monad'],
    [ChainId.HYPERLIQUID_MAINNET, 'hyperevm'],
    [ChainId.UNICHAIN_MAINNET, 'unichain'],
    [ChainId.BERACHAIN_MAINNET, 'berachain'],
    [ChainId.ABSTRACT_MAINNET, 'abstract'],
    [ChainId.TAIKO_MAINNET, 'taiko'],
    [ChainId.METIS_MAINNET, 'metis'],
    [ChainId.MORPH_MAINNET, 'morph'],
    [ChainId.KATANA_MAINNET, 'katana'],
    [ChainId.TEMPO_MAINNET, 'tempo'],
    [ChainId.TELOS_MAINNET, 'telos'],
])

interface FlyQuoteResponse {
    quote: {
        id: string
        amountOut: string
        targetAddress: string
        fees: { type: string; value: string }[]
        resourceEstimate: { gasLimit: string }
        typedData: {
            message: {
                amountOutMin: string
            }
        }
    }
    transaction: {
        from: string
        to: string
        data: string
        chainId: number
        type: number
        gasLimit: string
        maxFeePerGas?: string
        maxPriorityFeePerGas?: string
        gasPrice?: string
        value: string
    }
}

export class FlyTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly from: string

    static isAvailable(chainId: ChainId): boolean {
        return CHAIN_ID_TO_FLY_NETWORK.has(chainId)
    }

    public constructor(params: FlyTradeParams) {
        super(params)
        if (!FlyTrade.isAvailable(this.tokenAmountIn.token.chainId)) {
            throw new FlyTradeError('Unsupported chain')
        }
        this.symbiosis = params.symbiosis
        this.from = params.from
    }

    get tradeType(): TradeProvider {
        return TradeProvider.FLY
    }

    @withTracing()
    public async init() {
        const apiKeys = this.symbiosis.flyConfig.apiKeys
        if (!apiKeys?.length) {
            throw new FlyTradeError('Missing Fly API key')
        }
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]

        const chainId = this.tokenAmountIn.token.chainId
        const network = CHAIN_ID_TO_FLY_NETWORK.get(chainId)!

        const fromToken = this.tokenAmountIn.token.isNative ? FLY_NATIVE_TOKEN : this.tokenAmountIn.token.address
        const toToken = this.tokenOut.isNative ? FLY_NATIVE_TOKEN : this.tokenOut.address
        const sellAmount = this.tokenAmountIn.raw.toString()
        const slippageDecimal = this.slippage / Number(BIPS_BASE.toString())

        const url = new URL(`${this.symbiosis.flyConfig.apiUrl}/aggregator/quote/transaction`)
        url.searchParams.set('network', network)
        url.searchParams.set('fromTokenAddress', fromToken)
        url.searchParams.set('toTokenAddress', toToken)
        url.searchParams.set('sellAmount', sellAmount)
        url.searchParams.set('slippage', slippageDecimal.toString())
        url.searchParams.set('fromAddress', this.from)
        url.searchParams.set('toAddress', this.to)
        url.searchParams.set('gasless', 'false')

        let response: Response
        try {
            response = await this.symbiosis.fetch(url.toString(), {
                headers: { apikey: apiKey },
                signal: this.signal,
            })
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') throw e
            throw new FlyTradeError(`Cannot get Fly quote for chain ${chainId}: ${e instanceof Error ? e.message : e}`)
        }

        if (!response.ok) {
            const text = await response.text()
            throw new FlyTradeError(`Cannot get Fly quote for chain ${chainId}: ${response.status} ${text}`)
        }

        const result: FlyQuoteResponse = await response.json()
        const { quote, transaction } = result

        const amountOut = new TokenAmount(this.tokenOut, quote.amountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, quote.typedData.message.amountOutMin)

        const priceImpact = await this.getPriceImpact(this.tokenAmountIn, amountOut)

        const callDataOffset = FlyTrade.findValueOffset(transaction.data, sellAmount)
        if (callDataOffset === 0) {
            throw new FlyTradeError(`Fly calldata: sellAmount slot not found for chain ${chainId}`)
        }

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: transaction.to as Address,
            approveTo: quote.targetAddress as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData: transaction.data,
            callDataOffset,
            // amountOutMin is in the packed section of calldata, not in a 32-byte ABI slot
            minReceivedOffset: 0,
            priceImpact,
            value: this.tokenAmountIn.token.isNative && transaction.value ? BigInt(transaction.value) : undefined,
        }

        return this
    }

    private async getPriceImpact(tokenAmountIn: TokenAmount, tokenAmountOut: TokenAmount): Promise<Percent> {
        const coinGecko = this.symbiosis.coinGecko
        try {
            const [tokenInPrice, tokenOutPrice] = await Promise.all([
                coinGecko.getTokenPriceCached(tokenAmountIn.token),
                coinGecko.getTokenPriceCached(tokenAmountOut.token),
            ])
            const inUsd = CoinGecko.getTokenAmountUsd(tokenAmountIn, tokenInPrice)
            const outUsd = CoinGecko.getTokenAmountUsd(tokenAmountOut, tokenOutPrice)
            const impact = -(1 - outUsd / inUsd)
            return new Percent(parseInt(`${impact * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
        } catch {
            return new Percent('0', BIPS_BASE)
        }
    }

    static findValueOffset(callData: string, value: string): number {
        const bn = new BigNumber(value)
        if (bn.isZero()) {
            return 0
        }
        const hex = bn.toString(16).padStart(64, '0').toLowerCase()
        const data = callData.toLowerCase()
        const hexPrefix = data.startsWith('0x') ? 2 : 0
        const pos = data.indexOf(hex, hexPrefix)
        if (pos === -1) {
            return 0
        }
        return (pos + 64 - hexPrefix) / 2
    }
}

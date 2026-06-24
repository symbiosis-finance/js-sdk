import crypto from 'crypto'
import { BigNumber } from 'ethers'
import { parseUnits } from '@ethersproject/units'
import JSBI from 'jsbi'

import { ChainId } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import { BIPS_BASE } from '../constants'
import { BitgetTradeError } from '../sdkError'
import { withTracing } from '../tracing'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, TradeProvider } from './symbiosisTrade'
import { validateOptimisticQuote } from './validateCallData'

// Bitget chain identifiers (EVM only — the Solana market is intentionally not wired
// up here). See https://web3.bitget.com/en/docs/configuration/chain-config.
const BITGET_CHAINS: Partial<Record<ChainId, string>> = {
    [ChainId.ETH_MAINNET]: 'eth',
    [ChainId.BSC_MAINNET]: 'bnb',
    [ChainId.BASE_MAINNET]: 'base',
    [ChainId.MATIC_MAINNET]: 'polygon',
    [ChainId.ARBITRUM_MAINNET]: 'arbitrum',
    [ChainId.AVAX_MAINNET]: 'avalanche-c',
    [ChainId.MORPH_MAINNET]: 'morph',
    [ChainId.HYPERLIQUID_MAINNET]: 'hyperevm',
}

// Native token is represented by an empty contract address in both the quote and
// swap requests.
const NATIVE_CONTRACT = ''

interface BitgetTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    origin?: Address
}

// Channel-selection step — returns the optimal `market` that must be fed back into
// the swap request. Amounts are human-readable decimals (e.g. "14092876.440486").
interface BitgetQuote {
    market: string
    toAmount: string
}

// The executable transaction Bitget builds for the swap.
interface BitgetSwapTransaction {
    to: string // router address the calldata executes against (also the approve target)
    data: string // calldata
    value: string // native token value to send (wei); "0" for ERC20 inputs
}

// `requestMod=rich` swap response. `outAmount` is a human-readable decimal, NOT raw base
// units, so it must be parsed against the output token's decimals.
interface BitgetSwap {
    outAmount: string
    minAmount: string // guaranteed minimum received, human-readable decimal; matches the value embedded in calldata
    fromTokenPrice: string // USD price of the input token
    toTokenPrice: string // USD price of the output token
    swapTransaction: BitgetSwapTransaction
}

interface BitgetResponse<T> {
    code?: number
    status?: number
    msg?: string
    message?: string
    data: T
}

export class BitgetTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly from: string
    private readonly origin?: Address
    private readonly chain: string

    static isAvailable(chainId: ChainId): boolean {
        return BITGET_CHAINS[chainId] !== undefined
    }

    public constructor(params: BitgetTradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.from = params.from
        this.origin = params.origin

        const chainId = this.tokenAmountIn.token.chainId
        const chain = BITGET_CHAINS[chainId]
        if (!chain) {
            throw new BitgetTradeError(`Unsupported chain: ${chainId}`)
        }
        this.chain = chain

        if (!this.symbiosis.bitgetConfig.apiKey || !this.symbiosis.bitgetConfig.apiSecret) {
            throw new BitgetTradeError('Bitget API key/secret is not set')
        }
    }

    get tradeType(): TradeProvider {
        return TradeProvider.BITGET
    }

    @withTracing()
    public async init() {
        const fromContract = this.tokenAmountIn.token.isNative ? NATIVE_CONTRACT : this.tokenAmountIn.token.address
        const toContract = this.tokenOut.isNative ? NATIVE_CONTRACT : this.tokenOut.address
        // Bitget's JSON API uses human-readable decimal amounts, not raw base units
        // (e.g. "1" for 1 USDT, not "1000000").
        const fromAmount = this.tokenAmountIn.toExact()
        // The on-chain calldata, however, embeds the raw integer amount — used below to
        // locate the input-amount slot for applyAmountIn() patching.
        const fromAmountRaw = this.tokenAmountIn.raw.toString()

        // SDK slippage is in bps; Bitget expects a percent number (e.g. 1 means 1%). Only
        // the swap request takes slippage — the quote does not.
        const slippage = this.slippage / 100

        const quote = await this.request<BitgetQuote>('/bgw-pro/swapx/pro/quote', {
            fromContract,
            fromAmount,
            fromChain: this.chain,
            toContract,
            toChain: this.chain,
            fromAddress: this.from,
        })

        const swap = await this.request<BitgetSwap>('/bgw-pro/swapx/pro/swap', {
            fromContract,
            fromAmount,
            fromChain: this.chain,
            toContract,
            toChain: this.chain,
            fromAddress: this.from,
            toAddress: this.to,
            txOrigin: this.origin ?? this.from,
            slippage,
            market: quote.market,
            requestMod: 'rich',
        })

        const routerAddress = swap.swapTransaction.to as Address
        const callData = swap.swapTransaction.data

        // Bitget returns human-readable decimal amounts; convert to raw base units.
        const amountOutRaw = BitgetTrade.toRaw(swap.outAmount, this.tokenOut.decimals)
        const amountOut = new TokenAmount(this.tokenOut, amountOutRaw)
        // Bitget returns the guaranteed minimum directly — use it as-is rather than
        // recomputing from slippage.
        const amountOutMinRaw = BitgetTrade.toRaw(swap.minAmount, this.tokenOut.decimals)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        const callDataOffset = BitgetTrade.findValueOffset(callData, fromAmountRaw)
        // Locate the minimum-received slot so applyAmountIn() can patch it when the input
        // changes — Bitget embeds this exact minAmount in the calldata.
        const minReceivedOffset = BitgetTrade.findValueOffset(callData, amountOutMinRaw)

        // Bitget's returned priceImpact is unreliable; derive it from the USD token prices
        // in the swap response instead.
        const priceImpact = BitgetTrade.computePriceImpact(
            this.tokenAmountIn,
            swap.fromTokenPrice,
            amountOut,
            swap.toTokenPrice
        )

        // Bitget occasionally returns overly optimistic quotes whose calldata cannot
        // execute on-chain. Simulate it (funding the executing sender) and reject the
        // quote if it reverts. Bitget builds the calldata for `fromAddress` (this.from),
        // so that is the on-chain sender to simulate.
        await validateOptimisticQuote({
            provider: this.symbiosis.getProvider(this.tokenAmountIn.token.chainId),
            logger: this.symbiosis.logger,
            providerName: 'Bitget',
            from: this.from,
            routerAddress,
            callData,
            tokenAmountIn: this.tokenAmountIn,
            amountOut,
            priceImpact,
        })

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress,
            approveTo: routerAddress,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset,
            minReceivedOffset,
            priceImpact,
        }

        return this
    }

    private async request<T>(apiPath: string, body: Record<string, unknown>): Promise<T> {
        const chainId = this.tokenAmountIn.token.chainId
        const { apiUrl, apiKey, apiSecret } = this.symbiosis.bitgetConfig

        const bodyString = JSON.stringify(body)
        const timestamp = Date.now().toString()
        const signature = BitgetTrade.sign(apiPath, bodyString, apiKey, apiSecret, timestamp)

        let response: Response
        try {
            response = await this.symbiosis.fetch(`${apiUrl}${apiPath}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'x-api-timestamp': timestamp,
                    'x-api-signature': signature,
                },
                body: bodyString,
                signal: this.signal,
            })
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') throw e
            throw new BitgetTradeError(`Cannot build trade for chain ${chainId}: ${e instanceof Error ? e.message : e}`)
        }

        if (!response.ok) {
            const text = await response.text()
            throw new BitgetTradeError(`Cannot build trade for chain ${chainId}: ${response.status} ${text}`)
        }

        const json = (await response.json()) as BitgetResponse<T>
        const code = json.code ?? json.status
        if (code !== 0) {
            throw new BitgetTradeError(
                `Cannot build trade for chain ${chainId}. Message: ${json.msg ?? json.message ?? 'Unknown error'}`
            )
        }

        return json.data
    }

    // HMAC-SHA256 signature over the alphabetically-sorted content object
    // ({ apiPath, body, x-api-key, x-api-timestamp }), base64-encoded.
    // See https://web3.bitget.com/en/docs/authentication.
    private static sign(apiPath: string, body: string, apiKey: string, apiSecret: string, timestamp: string): string {
        const content = {
            apiPath,
            body,
            'x-api-key': apiKey,
            'x-api-timestamp': timestamp,
        }
        const sortedKeys = (Object.keys(content) as (keyof typeof content)[]).sort()
        const sortedContent = Object.fromEntries(sortedKeys.map((key) => [key, content[key]]))
        const payload = JSON.stringify(sortedContent)
        return crypto.createHmac('sha256', apiSecret).update(payload).digest('base64')
    }

    // Bitget's own priceImpact field is unreliable, so we compute it from the USD prices
    // returned alongside the swap: 1 - (amountOut * toTokenPrice) / (amountIn * fromTokenPrice).
    // Positive = value lost (same sign convention as OneInchTrade.getTradePriceImpact).
    static computePriceImpact(
        tokenAmountIn: TokenAmount,
        fromTokenPrice: string,
        amountOut: TokenAmount,
        toTokenPrice: string
    ): Percent {
        const inputUsd = Number(tokenAmountIn.toExact()) * Number(fromTokenPrice)
        const outputUsd = Number(amountOut.toExact()) * Number(toTokenPrice)
        if (!Number.isFinite(inputUsd) || !Number.isFinite(outputUsd) || inputUsd <= 0) {
            return new Percent('0', BIPS_BASE)
        }
        const impactNumber = 1 - outputUsd / inputUsd
        return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
    }

    // Converts a Bitget human-readable decimal amount (e.g. "14092957.333021") into a
    // raw base-unit string for the given token decimals. Fractional digits beyond the
    // token's precision are truncated so parseUnits never throws.
    static toRaw(amount: string, decimals: number): string {
        const [whole, fraction = ''] = amount.split('.')
        const normalized = fraction ? `${whole}.${fraction.slice(0, decimals)}` : whole
        return parseUnits(normalized, decimals).toString()
    }

    // Searches for a uint256 value in calldata and returns its byte offset (end of the
    // 32-byte slot). Returns 0 if not found (applyAmountIn skips patching when offset
    // is 0). Bitget calldata targets its own router, so offsets are detected generically
    // rather than by method signature.
    static findValueOffset(callData: string, value: string): number {
        const bn = BigNumber.from(value)
        if (bn.isZero()) {
            return 0
        }
        const hex = bn.toHexString().slice(2).padStart(64, '0')
        const hexPrefix = callData.startsWith('0x') ? 2 : 0
        const pos = callData.indexOf(hex, hexPrefix)
        if (pos === -1) {
            return 0
        }
        return (pos + 64 - hexPrefix) / 2
    }
}

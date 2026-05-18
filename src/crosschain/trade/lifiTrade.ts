import BigNumber from 'bignumber.js'

import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import { lifiApi } from '../api/lifi'
import { BIPS_BASE } from '../constants'
import { LifiTradeError } from '../sdkError'
import { withTracing } from '../tracing'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, TradeProvider } from './symbiosisTrade'

interface LifiTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
}

const LIFI_SUPPORTED_CHAINS: Set<ChainId> = new Set([
    ChainId.ETH_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.CRONOS_MAINNET,
    ChainId.RSK_MAINNET,
    ChainId.TELOS_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.GNOSIS_MAINNET,
    ChainId.UNICHAIN_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.MONAD_MAINNET,
    ChainId.SONIC_MAINNET,
    ChainId.OPBNB_MAINNET,
    ChainId.FRAXTAL_MAINNET,
    ChainId.BOBA_MAINNET,
    ChainId.ZKSYNC_MAINNET,
    ChainId.METIS_MAINNET,
    ChainId.SEI_EVM_MAINNET,
    ChainId.GRAVITY_MAINNET,
    ChainId.SONEIUM_MAINNET,
    ChainId.ABSTRACT_MAINNET,
    ChainId.MORPH_MAINNET,
    ChainId.MANTLE_MAINNET,
    ChainId.BASE_MAINNET,
    ChainId.APECHAIN_MAINNET,
    ChainId.MODE_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.LINEA_MAINNET,
    ChainId.BERACHAIN_MAINNET,
    ChainId.BLAST_MAINNET,
    ChainId.TAIKO_MAINNET,
    ChainId.SCROLL_MAINNET,
    ChainId.KATANA_MAINNET,
    ChainId.HYPERLIQUID_MAINNET,
    ChainId.PLASMA_MAINNET,
    ChainId.ARBITRUM_NOVA,
    ChainId.TEMPO_MAINNET,
])

export class LifiTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly from: string

    static isAvailable(chainId: ChainId): boolean {
        return LIFI_SUPPORTED_CHAINS.has(chainId)
    }

    public constructor(params: LifiTradeParams) {
        super(params)
        if (!LifiTrade.isAvailable(this.tokenAmountIn.token.chainId)) {
            throw new LifiTradeError('Unsupported chain')
        }
        this.symbiosis = params.symbiosis
        this.from = params.from
    }

    get tradeType(): TradeProvider {
        return TradeProvider.LIFI
    }

    @withTracing()
    public async init() {
        const apiKeys = this.symbiosis.lifiConfig.apiKeys
        if (apiKeys.length === 0) {
            throw new LifiTradeError('Missing LiFi API key')
        }
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]

        const chainId = this.tokenAmountIn.token.chainId

        const fromToken = this.tokenAmountIn.token.isNative ? NATIVE_TOKEN_ADDRESS : this.tokenAmountIn.token.address
        const toToken = this.tokenOut.isNative ? NATIVE_TOKEN_ADDRESS : this.tokenOut.address

        const quote = await lifiApi.v1
            .quoteList(
                {
                    fromChain: String(chainId),
                    toChain: String(chainId),
                    fromToken,
                    toToken,
                    fromAmount: this.tokenAmountIn.raw.toString(),
                    fromAddress: this.from,
                    toAddress: this.to,
                    slippage: this.slippage / Number(BIPS_BASE.toString()),
                    integrator: 'symbiosis',
                    skipSimulation: true,
                },
                { headers: { 'x-lifi-api-key': apiKey }, signal: this.signal }
            )
            .catch((e) => {
                if (e instanceof Error && e.name === 'AbortError') throw e
                const err = e as {
                    error?: {
                        message?: string
                        errors?: Array<{ tool?: string; code?: string; message?: string }>
                    }
                    message?: string
                }
                const baseMsg = err?.error?.message ?? err?.message ?? JSON.stringify(e)
                const toolErrors = err?.error?.errors
                    ?.map((t) => `${t.tool ?? '?'}: ${t.code ?? '?'}`)
                    .join(', ')
                const msg = toolErrors ? `${baseMsg} [${toolErrors}]` : baseMsg
                throw new LifiTradeError(`Cannot get LiFi quote for chain ${chainId}: ${msg}`)
            })

        if ((quote.includedSteps?.length ?? 0) > 1) {
            throw new LifiTradeError(
                `LiFi returned multi-step route (${quote.includedSteps?.length} steps) for chain ${chainId}`
            )
        }

        const tx = quote.transactionRequest
        const estimate = quote.estimate
        if (!tx || !estimate) {
            throw new LifiTradeError(`LiFi response missing transactionRequest/estimate for chain ${chainId}`)
        }

        if (!tx.to) {
            throw new LifiTradeError(`LiFi response missing transactionRequest.to for chain ${chainId}`)
        }
        if (!tx.data) {
            throw new LifiTradeError(`LiFi response missing transactionRequest.data for chain ${chainId}`)
        }

        const amountOut = new TokenAmount(this.tokenOut, estimate.toAmount)
        const amountOutMin = new TokenAmount(this.tokenOut, estimate.toAmountMin)

        const priceImpact = this.calcPriceImpact(estimate.fromAmountUSD, estimate.toAmountUSD)

        const callDataOffset = LifiTrade.findValueOffset(tx.data, estimate.fromAmount)
        if (callDataOffset === 0) {
            throw new LifiTradeError(`LiFi calldata: fromAmount slot not found for chain ${chainId}`)
        }
        const minReceivedOffset = LifiTrade.findValueOffset(tx.data, estimate.toAmountMin)
        if (minReceivedOffset === 0) {
            throw new LifiTradeError(`LiFi calldata: toAmountMin slot not found for chain ${chainId}`)
        }

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: tx.to as Address,
            approveTo: estimate.approvalAddress as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData: tx.data,
            callDataOffset,
            minReceivedOffset,
            priceImpact,
            value: this.tokenAmountIn.token.isNative && tx.value ? BigInt(tx.value) : undefined,
        }

        return this
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

    private calcPriceImpact(amountInUsd: string | undefined, amountOutUsd: string | undefined): Percent {
        const zeroPercent = new Percent('0', BIPS_BASE)
        if (!amountInUsd || !amountOutUsd) return zeroPercent
        const inUsd = new BigNumber(amountInUsd)
        const outUsd = new BigNumber(amountOutUsd)
        if (inUsd.isZero() || inUsd.isNaN() || outUsd.isNaN()) {
            return zeroPercent
        }
        const impact = inUsd.minus(outUsd).div(inUsd)
        if (!impact.isFinite() || impact.isNegative()) {
            return zeroPercent
        }
        const bps = impact.multipliedBy(10000).integerValue().toNumber()
        return new Percent(bps.toString(), BIPS_BASE)
    }
}

import { utils } from 'ethers'
import type { Percent, Token, TokenAmount } from '../../entities'
import { AggregateSdkError, AggregatorTradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address, FeeItem } from '../types'
import { IzumiTrade } from './izumiTrade'
import { KyberSwapTrade } from './kyberSwapTrade'
import { FlyTrade } from './flyTrade'
import type { OneInchProtocols } from './oneInchTrade'
import { OneInchTrade } from './oneInchTrade'
import { OpenOceanTrade } from './openOceanTrade'
import type { SymbiosisTradeOutResult, SymbiosisTradeParams, TradeProvider } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'
import { UniV2Trade } from './uniV2Trade'
import { UniV3Trade } from './uniV3Trade'
import { UniV4Trade } from './uniV4Trade'
import { ZeroXTrade } from './zeroXTrade'
import { withTracing } from '../tracing'

type Trade =
    | OneInchTrade
    | OpenOceanTrade
    | KyberSwapTrade
    | ZeroXTrade
    | FlyTrade
    | IzumiTrade
    | UniV2Trade
    | UniV3Trade
    | UniV4Trade

export interface AggregatorTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    origin?: Address
    clientId: string
    deadline: number // epoch
    oneInchProtocols?: OneInchProtocols
    timeoutMs?: number // stop waiting for other quotes after this timeout if at least a single quote is available.
    disabledProviders?: TradeProvider[]
}

class TradeNotInitializedError extends Error {
    constructor(msg?: string) {
        super(`Trade is not initialized: ${msg}`)
    }
}

interface TradeEntry {
    promise: Promise<Trade>
    label: string
    priority: boolean
}

interface SelectBestTradeOptions {
    timeoutMs?: number
    abortController?: AbortController
    onError?: (label: string, error: Error) => void
}

function selectBestTrade(entries: TradeEntry[], options: SelectBestTradeOptions): Promise<Trade> {
    if (entries.length === 0) {
        return Promise.reject(new AggregatorTradeError('AggregatorTrade: no trades given'))
    }

    return new Promise<Trade>((resolve, reject) => {
        const results: Trade[] = []
        const errors: Error[] = []
        let settled = 0
        let resolved = false
        let timedOut = false
        let hasPriorityResult = false

        const finish = () => {
            if (resolved) return
            resolved = true
            options?.abortController?.abort()
            if (results.length > 0) {
                resolve(bestByAmountOut(results))
            } else {
                reject(new AggregateSdkError(errors, 'AggregatorTrade: all trades failed'))
            }
        }

        const tryResolve = () => {
            if (resolved) return

            if (settled === entries.length) {
                finish()
                return
            }

            if (timedOut && hasPriorityResult) {
                finish()
            }
        }

        if (options.timeoutMs !== undefined) {
            setTimeout(() => {
                timedOut = true
                tryResolve()
            }, options.timeoutMs)
        }

        for (const { promise, label, priority } of entries) {
            withTimeout(promise, label).then(
                (trade) => {
                    results.push(trade)
                    if (priority) hasPriorityResult = true
                    settled++
                    tryResolve()
                },
                (error) => {
                    options?.onError?.(label, error)
                    errors.push(error)
                    settled++
                    tryResolve()
                }
            )
        }
    })
}

function bestByAmountOut(trades: Trade[]): Trade {
    if (trades.length === 0) {
        throw new AggregatorTradeError('AggregatorTrade: no trades to compare')
    }
    return trades.reduce((best, trade) => (trade.amountOut.greaterThan(best.amountOut) ? trade : best))
}

function withTimeout<T>(promise: Promise<T>, name: string, timeout: number = 30_000 /* 30 seconds */): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timeout: ${name}`))
        }, timeout)
        promise
            .then((res) => {
                clearTimeout(timer)
                resolve(res)
            })
            .catch((err) => {
                clearTimeout(timer)
                reject(err)
            })
    })
}

export class AggregatorTrade extends SymbiosisTrade {
    // The best found trade. It is always set after waiting for init().
    protected trade!: Trade

    constructor(private params: AggregatorTradeParams) {
        super(params)
    }

    get tradeType(): TradeProvider {
        this.assertTradeInitialized('tradeType')
        return this.trade.tradeType
    }

    @withTracing()
    public async init() {
        const {
            from,
            origin,
            slippage,
            symbiosis,
            deadline,
            to,
            tokenAmountIn,
            tokenAmountInMin,
            tokenOut,
            oneInchProtocols,
            disabledProviders,
            timeoutMs,
        } = this.params

        const clientId = utils.parseBytes32String(symbiosis.clientId)
        const isOneInchClient = clientId === '1inch'
        const isOpenOceanClient = clientId === 'openocean'
        const isOtherClient = !isOneInchClient && !isOpenOceanClient

        const isOneInchAvailable =
            OneInchTrade.isAvailable(tokenAmountIn.token.chainId) &&
            OneInchTrade.isAllowed(disabledProviders) &&
            !isOpenOceanClient

        const isOpenOceanAvailable =
            OpenOceanTrade.isAvailable(tokenAmountIn.token.chainId) &&
            OpenOceanTrade.isAllowed(disabledProviders) &&
            !isOneInchClient

        const isKyberSwapAvailable =
            KyberSwapTrade.isAvailable(tokenAmountIn.token.chainId) &&
            KyberSwapTrade.isAllowed(disabledProviders) &&
            !isOneInchClient &&
            !isOpenOceanClient

        const isZeroXAvailable =
            ZeroXTrade.isAvailable(tokenAmountIn.token.chainId) &&
            ZeroXTrade.isAllowed(disabledProviders) &&
            !isOneInchClient &&
            !isOpenOceanClient

        const isFlyAvailable =
            FlyTrade.isAvailable(tokenAmountIn.token.chainId) &&
            FlyTrade.isAllowed(disabledProviders) &&
            !isOneInchClient &&
            !isOpenOceanClient

        const abortController = new AbortController()
        const signal = abortController.signal
        const entries: TradeEntry[] = []

        if (isOneInchAvailable) {
            const oneInchTrade = new OneInchTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                from,
                origin,
                to,
                slippage,
                protocols: oneInchProtocols,
                signal,
            })
            entries.push({ promise: oneInchTrade.init(), label: '1inch', priority: true })
        }

        if (isOpenOceanAvailable) {
            const openOceanTrade = new OpenOceanTrade({
                symbiosis,
                to,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                signal,
            })
            entries.push({ promise: openOceanTrade.init(), label: 'OpenOcean', priority: true })
        }

        if (isKyberSwapAvailable) {
            const kyberSwapTrade = new KyberSwapTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                from,
                origin,
                to,
                slippage,
                signal,
            })
            entries.push({ promise: kyberSwapTrade.init(), label: 'KyberSwap', priority: true })
        }

        if (isZeroXAvailable) {
            const zeroXTrade = new ZeroXTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                from,
                origin,
                to,
                slippage,
                signal,
            })
            entries.push({ promise: zeroXTrade.init(), label: '0x', priority: true })
        }

        if (isFlyAvailable) {
            const flyTrade = new FlyTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                from,
                to,
                slippage,
                signal,
            })
            entries.push({ promise: flyTrade.init(), label: 'Fly', priority: true })
        }

        if (
            isOtherClient &&
            IzumiTrade.isSupported(tokenAmountIn.token.chainId) &&
            IzumiTrade.isAllowed(disabledProviders)
        ) {
            const izumiTrade = new IzumiTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                deadline,
                to,
                signal,
            })
            entries.push({ promise: izumiTrade.init(), label: 'Izumi', priority: false })
        }

        if (
            isOtherClient &&
            UniV3Trade.isSupported(tokenAmountIn.token.chainId) &&
            UniV3Trade.isAllowed(disabledProviders)
        ) {
            const uniV3Trade = new UniV3Trade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                deadline,
                to,
                signal,
            })
            entries.push({ promise: uniV3Trade.init(), label: 'UniV3', priority: false })
        }

        if (
            isOtherClient &&
            UniV4Trade.isSupported(tokenAmountIn.token.chainId) &&
            UniV4Trade.isAllowed(disabledProviders)
        ) {
            const uniV4Trade = new UniV4Trade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                slippage,
                deadline,
                to,
                from,
                signal,
            })
            entries.push({ promise: uniV4Trade.init(), label: 'UniV4', priority: false })
        }

        if (
            isOtherClient &&
            UniV2Trade.isSupported(symbiosis, tokenAmountIn.token.chainId) &&
            UniV2Trade.isAllowed(disabledProviders)
        ) {
            const uniV2Trade = new UniV2Trade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin,
                tokenOut,
                to,
                slippage,
                deadline,
                signal,
            })
            entries.push({ promise: uniV2Trade.init(), label: 'UniV2', priority: false })
        }

        this.trade = await selectBestTrade(entries, {
            timeoutMs,
            abortController,
            onError: (label, e) => {
                if (e.name === 'AbortError') return
                symbiosis.logger?.error(`AggregatorTrade.onError ${label} failed: ${e.message}`)
                symbiosis.countAggregatorError({
                    provider: label,
                    reason: e.message,
                    chain_id: String(tokenOut.chain?.id),
                })
            },
        })

        return this
    }

    get amountOut(): TokenAmount {
        this.assertTradeInitialized('amountOut')
        return this.trade.amountOut
    }

    get amountOutMin(): TokenAmount {
        this.assertTradeInitialized('amountOutMin')
        return this.trade.amountOutMin
    }

    get routerAddress(): Address {
        this.assertTradeInitialized('routerAddress')
        return this.trade.routerAddress
    }

    get approveTo(): Address {
        this.assertTradeInitialized('approveTo')
        return this.trade.approveTo
    }

    get permit2Approve(): SymbiosisTradeOutResult['permit2Approve'] | undefined {
        this.assertTradeInitialized('permit2Approve')
        return this.trade.permit2Approve
    }

    get route(): Token[] {
        this.assertTradeInitialized('route')
        return this.trade.route
    }

    get callData(): string {
        this.assertTradeInitialized('callData')
        return this.trade.callData
    }

    get callDataOffset(): number {
        this.assertTradeInitialized('callDataOffset')
        return this.trade.callDataOffset
    }

    get minReceivedOffset(): number {
        this.assertTradeInitialized('minReceivedOffset')
        return this.trade.minReceivedOffset
    }

    get priceImpact(): Percent {
        this.assertTradeInitialized('priceImpact')
        return this.trade.priceImpact
    }

    // Needed only for Tron.
    get functionSelector(): string | undefined {
        this.assertTradeInitialized('functionSelector')
        return this.trade.functionSelector
    }

    public async applyAmountIn(newAmountIn: TokenAmount, newAmountInMin: TokenAmount) {
        this.assertTradeInitialized('applyAmountIn')
        this.trade.applyAmountIn(newAmountIn, newAmountInMin)
        this.tokenAmountIn = newAmountIn
        this.tokenAmountInMin = newAmountInMin
    }

    get fees(): FeeItem[] | undefined {
        this.assertTradeInitialized('fees')
        return this.trade.fees
    }

    private assertTradeInitialized(msg?: string): asserts this is {
        trade: Trade
    } {
        if (!this.trade) {
            throw new TradeNotInitializedError(msg)
        }
    }
}

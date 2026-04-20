import BigNumber from 'bignumber.js'

import { ChainId } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import type { BuildRoutePostBody, BuildRouteSuccess, GetRouteSuccess } from '../api/kyberswap'
import { kyberSwapApi } from '../api/kyberswap'
import { getMinAmount } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { KyberSwapTradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

const KYBER_SWAP_NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

interface KyberSwapTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    origin?: Address
}

interface KyberSwapChain {
    slug: string
}

const KYBER_SWAP_NETWORKS: Partial<Record<ChainId, KyberSwapChain>> = {
    [ChainId.ETH_MAINNET]: { slug: 'ethereum' },
    [ChainId.BSC_MAINNET]: { slug: 'bsc' },
    [ChainId.MATIC_MAINNET]: { slug: 'polygon' },
    [ChainId.OPTIMISM_MAINNET]: { slug: 'optimism' },
    [ChainId.ARBITRUM_MAINNET]: { slug: 'arbitrum' },
    [ChainId.AVAX_MAINNET]: { slug: 'avalanche' },
    [ChainId.BASE_MAINNET]: { slug: 'base' },
    [ChainId.LINEA_MAINNET]: { slug: 'linea' },
    [ChainId.MANTLE_MAINNET]: { slug: 'mantle' },
    [ChainId.SONIC_MAINNET]: { slug: 'sonic' },
    [ChainId.BERACHAIN_MAINNET]: { slug: 'berachain' },
    [ChainId.SCROLL_MAINNET]: { slug: 'scroll' },
}

// KyberSwap MetaAggregationRouterV2 function selectors
const SWAP_SELECTOR = 'e21fd0e9'
const SWAP_SIMPLE_MODE_SELECTOR = '8af033fb'
const SWAP_GENERIC_SELECTOR = '59e50fed'

type RouteSummary = GetRouteSuccess['data']['routeSummary']
type BuildRouteData = BuildRouteSuccess['data']

export class KyberSwapTrade extends SymbiosisTrade {
    private readonly chain: KyberSwapChain
    private readonly symbiosis: Symbiosis
    private readonly from: string
    private readonly origin?: Address

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(KYBER_SWAP_NETWORKS).includes(chainId.toString())
    }

    public constructor(params: KyberSwapTradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        const chainId = this.tokenAmountIn.token.chainId
        const chain = KYBER_SWAP_NETWORKS[chainId]
        if (!chain) {
            throw new KyberSwapTradeError('Unsupported chain')
        }
        this.chain = chain
        this.from = params.from
        this.origin = params.origin
    }

    get tradeType(): SymbiosisTradeType {
        return SymbiosisTradeType.KYBER_SWAP
    }

    public async init() {
        const { routeSummary } = await this.getRoute()
        const buildResult = await this.buildRoute(routeSummary)

        const callData = buildResult.data
        const { amountOffset, minReceivedOffset } = KyberSwapTrade.getOffsets(callData)

        const amountOut = new TokenAmount(this.tokenOut, buildResult.amountOut)
        const amountOutMinRaw = getMinAmount(this.slippage, buildResult.amountOut)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        const priceImpact = this.calcPriceImpact(routeSummary.amountInUsd, routeSummary.amountOutUsd)

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: buildResult.routerAddress as Address,
            approveTo: buildResult.routerAddress as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset: amountOffset,
            minReceivedOffset,
            priceImpact,
        }

        return this
    }

    private async getRoute(): Promise<{ routeSummary: RouteSummary; routerAddress: string }> {
        const chainId = this.tokenAmountIn.token.chainId

        return this.symbiosis.cache.get(
            [
                'kyberSwapRoute',
                chainId.toString(),
                this.tokenAmountIn.token.address,
                this.tokenOut.address,
                this.tokenAmountIn.raw.toString(),
            ],
            async () => {
                let fromTokenAddress = this.tokenAmountIn.token.address
                if (this.tokenAmountIn.token.isNative) {
                    fromTokenAddress = KYBER_SWAP_NATIVE_TOKEN
                }

                let toTokenAddress = this.tokenOut.address
                if (this.tokenOut.isNative) {
                    toTokenAddress = KYBER_SWAP_NATIVE_TOKEN
                }

                const result = await kyberSwapApi.chain.getRoute(this.chain.slug, {
                    tokenIn: fromTokenAddress,
                    tokenOut: toTokenAddress,
                    amountIn: this.tokenAmountIn.raw.toString(),
                    gasInclude: true,
                    onlyScalableSources: true,
                    origin: this.origin,
                })

                if (result.code !== 0) {
                    throw new KyberSwapTradeError(
                        `Cannot get route for chain ${chainId}: ${result.message ?? result.code}`
                    )
                }

                return result.data
            },
            5
        )
    }

    private async buildRoute(routeSummary: RouteSummary): Promise<BuildRouteData> {
        const result = await kyberSwapApi.chain.postRouteEncoded(this.chain.slug, {
            routeSummary: routeSummary as unknown as BuildRoutePostBody['routeSummary'],
            sender: this.from,
            recipient: this.to,
            origin: this.origin,
            slippageTolerance: this.slippage,
        })

        if (result.code !== 0) {
            throw new KyberSwapTradeError(
                `Cannot build route for chain ${this.tokenAmountIn.token.chainId}: ${result.message ?? result.code}`
            )
        }

        return result.data
    }

    /**
     * Dynamically computes offsets for amount and minReturnAmount in KyberSwap router calldata.
     *
     * KyberSwap uses SwapDescriptionV2 with dynamic-length arrays, so offsets to `amount`
     * and `minReturnAmount` depend on the actual calldata content. We parse ABI encoding
     * to locate them.
     *
     * SwapDescriptionV2 head layout (each field is 32 bytes):
     *   [0] srcToken
     *   [1] dstToken
     *   [2] offset to srcReceivers
     *   [3] offset to srcAmounts
     *   [4] offset to feeReceivers
     *   [5] offset to feeAmounts
     *   [6] dstReceiver
     *   [7] amount          <- callDataOffset
     *   [8] minReturnAmount <- minReceivedOffset
     *   [9] flags
     *  [10] offset to permit
     */
    static getOffsets(callData: string): { amountOffset: number; minReceivedOffset: number } {
        const sigHash = callData.slice(2, 10)

        if (sigHash === SWAP_SELECTOR || sigHash === SWAP_GENERIC_SELECTOR) {
            const tupleStart = 4 + 32
            const descOffsetSlot = tupleStart + 3 * 32
            const descOffset = parseInt(callData.slice(2 + descOffsetSlot * 2, 2 + (descOffsetSlot + 32) * 2), 16)
            const descStart = tupleStart + descOffset

            return {
                amountOffset: descStart + 8 * 32,
                minReceivedOffset: descStart + 9 * 32,
            }
        }

        if (sigHash === SWAP_SIMPLE_MODE_SELECTOR) {
            const paramsStart = 4
            const descOffsetSlot = paramsStart + 32
            const descOffset = parseInt(callData.slice(2 + descOffsetSlot * 2, 2 + (descOffsetSlot + 32) * 2), 16)
            const descStart = paramsStart + descOffset

            return {
                amountOffset: descStart + 8 * 32,
                minReceivedOffset: descStart + 9 * 32,
            }
        }

        throw new KyberSwapTradeError(`Unknown KyberSwap swap method: 0x${sigHash}`)
    }

    private calcPriceImpact(amountInUsd: string, amountOutUsd: string): Percent {
        const zeroPercent = new Percent('0', BIPS_BASE)
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

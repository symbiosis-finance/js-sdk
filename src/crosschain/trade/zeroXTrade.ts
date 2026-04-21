import { BigNumber } from 'ethers'

import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import { BIPS_BASE } from '../constants'
import { ZeroXTradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { Address } from '../types'
import { SymbiosisTrade, type SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { AddressZero } from '@ethersproject/constants'

// AllowanceHolder.exec(address operator, address token, uint256 amount, address target, bytes data)
const EXEC_SELECTOR = '2213bc0b'

const ZERO_X_SUPPORTED_CHAINS: Set<ChainId> = new Set([
    ChainId.ETH_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.BASE_MAINNET,
    ChainId.LINEA_MAINNET,
    ChainId.SCROLL_MAINNET,
    ChainId.BLAST_MAINNET,
    ChainId.MANTLE_MAINNET,
    ChainId.SONIC_MAINNET,
    ChainId.BERACHAIN_MAINNET,
    ChainId.MODE_MAINNET,
    ChainId.UNICHAIN_MAINNET,
])

interface ZeroXTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    origin?: Address
}

interface ZeroXQuoteResponse {
    liquidityAvailable: boolean
    buyAmount: string
    sellAmount: string
    minBuyAmount: string
    allowanceTarget: string | null
    transaction: {
        to: string
        data: string
        gas: string
        gasPrice: string
        value: string
    }
    route: {
        fills: { from: string; to: string; source: string; proportionBps: string }[]
        tokens: { address: string; symbol: string }[]
    }
    totalNetworkFee: string
}

export class ZeroXTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly from: string
    private readonly origin?: Address
    private readonly apiKey: string

    static isAvailable(chainId: ChainId): boolean {
        return ZERO_X_SUPPORTED_CHAINS.has(chainId)
    }

    public constructor(params: ZeroXTradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.from = params.from
        this.origin = params.origin

        const chainId = this.tokenAmountIn.token.chainId
        if (!ZeroXTrade.isAvailable(chainId)) {
            throw new ZeroXTradeError(`Unsupported chain: ${chainId}`)
        }
        if (this.symbiosis.zeroXConfig.apiKeys.length === 0) {
            throw new ZeroXTradeError('ZeroX API key is not set')
        }
        this.apiKey = this.symbiosis.zeroXConfig.apiKeys[0]
    }

    get tradeType(): SymbiosisTradeType {
        return SymbiosisTradeType.ZERO_X
    }

    public async init() {
        const quote = await this.getQuote()

        if (!quote.liquidityAvailable) {
            throw new ZeroXTradeError('No liquidity available')
        }

        const callData = quote.transaction.data
        const amountOffset = ZeroXTrade.getAmountOffset(callData)
        const minReceivedOffset = ZeroXTrade.findValueOffset(callData, quote.minBuyAmount)

        const amountOut = new TokenAmount(this.tokenOut, quote.buyAmount)
        const amountOutMin = new TokenAmount(this.tokenOut, quote.minBuyAmount)

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: quote.transaction.to as Address,
            approveTo: (quote.allowanceTarget ?? AddressZero) as Address,
            route: [this.tokenAmountIn.token, this.tokenOut],
            callData,
            callDataOffset: amountOffset,
            minReceivedOffset,
            priceImpact: new Percent('0', BIPS_BASE),
        }

        return this
    }

    private async getQuote(): Promise<ZeroXQuoteResponse> {
        const chainId = this.tokenAmountIn.token.chainId

        const sellToken = this.tokenAmountIn.token.isNative ? NATIVE_TOKEN_ADDRESS : this.tokenAmountIn.token.address
        const buyToken = this.tokenOut.isNative ? NATIVE_TOKEN_ADDRESS : this.tokenOut.address

        const url = new URL(`${this.symbiosis.zeroXConfig.apiUrl}/swap/allowance-holder/quote`)
        url.searchParams.set('chainId', chainId.toString())
        url.searchParams.set('sellToken', sellToken)
        url.searchParams.set('buyToken', buyToken)
        url.searchParams.set('sellAmount', this.tokenAmountIn.raw.toString())
        url.searchParams.set('taker', this.from)
        url.searchParams.set('recipient', this.to)
        url.searchParams.set('slippageBps', this.slippage.toString())
        url.searchParams.set('sellEntireBalance', 'true')
        if (this.origin) {
            url.searchParams.set('txOrigin', this.origin)
        }

        const response = await this.symbiosis.fetch(url.toString(), {
            headers: {
                '0x-api-key': this.apiKey,
                '0x-version': 'v2',
            },
        })

        if (!response.ok) {
            const text = await response.text()
            throw new ZeroXTradeError(`Cannot get quote for chain ${chainId}: ${response.status} ${text}`)
        }

        return (await response.json()) as ZeroXQuoteResponse
    }

    /**
     * Returns the byte offset (end) of the `amount` parameter in AllowanceHolder.execute calldata.
     *
     * execute(address operator, address token, uint256 amount, address target, bytes data)
     * Layout: selector(4) + operator(32) + token(32) + amount(32) + ...
     * amount ends at byte 4 + 3*32 = 100
     */
    static getAmountOffset(callData: string): number {
        const sigHash = callData.slice(2, 10)
        if (sigHash !== EXEC_SELECTOR) {
            throw new ZeroXTradeError(`Unknown 0x swap method: 0x${sigHash}`)
        }
        return 4 + 3 * 32 // 100
    }

    /**
     * Searches for a uint256 value in calldata and returns its byte offset (end of 32-byte slot).
     * Returns 0 if not found (applyAmountIn skips patching when offset is 0).
     */
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

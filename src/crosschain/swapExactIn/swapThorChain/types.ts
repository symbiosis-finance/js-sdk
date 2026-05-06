import type { Token } from '../../../entities'
import type { BaseQuoteResponse, QuoteFees, QuoteSwapResponse } from '../../api/thorchain'

export type ThorChainDestination = {
    token: Token
    thorAsset: string // e.g. "BTC.BTC" or "ETH.USDC-0xA0B8…"
}

export type ThorChainQuoteSwapResponse = BaseQuoteResponse &
    QuoteSwapResponse & {
        fees: QuoteFees
        router: string
        memo: string
        amount_out_min: string
    }

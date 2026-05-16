import type { Token } from '../../../entities'

export type ThorChainDestination = {
    token: Token
    thorAsset: string // e.g. "BTC.BTC" or "ETH.USDC-0XA0B8…"
}

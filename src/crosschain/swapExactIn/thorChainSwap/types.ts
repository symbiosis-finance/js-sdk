import type { Token } from '../../../entities'

export type ThorChainDestination = {
    token: Token
    thorAsset: string // e.g. "BTC.BTC" or "ETH.USDC-0XA0B8…"
    isEvmConnectorToken?: boolean
    isThorChainOnlyDestination?: boolean // for L1 chains LTC, BCH, XRP, DOGE
}

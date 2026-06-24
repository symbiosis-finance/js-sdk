import type { Asset, Chain } from '@chainflip/sdk/swap'

import type { Token } from '../../../entities'

export enum ChainFlipChainId {
    Ethereum = 1,
    Bitcoin = 3,
    Arbitrum = 4,
    Solana = 5,
    Tron = 7,
}

export enum ChainFlipAssetId {
    ETH = 1,
    USDC = 3,
    BTC = 5,
    arbETH = 6,
    arbUSDC = 7,
    USDT = 8,
    SOL = 9,
    solUSDC = 10,
    Trx = 17,
    TrxUsdt = 18,
}

export interface ChainFlipToken {
    chainId: ChainFlipChainId
    assetId: ChainFlipAssetId
    chain: Chain
    asset: Asset
    token: Token
}

export interface ChainFlipConfig {
    src: ChainFlipToken
    dst: ChainFlipToken
}

import type { Asset, Chain } from '@chainflip/sdk/swap'

import type { Token } from '../../../entities'

export enum ChainFlipChainId {
    Ethereum = 1,
    Polkadot = 2,
    Bitcoin = 3,
    Arbitrum = 4,
    Solana = 5,
}

export enum ChainFlipAssetId {
    ETH = 1,
    FLIP = 2,
    USDC = 3,
    DOT = 4,
    BTC = 5,
    arbETH = 6,
    arbUSDC = 7,
    USDT = 8,
    SOL = 9,
    solUSDC = 10,
}

export interface ChainFlipToken {
    chainId: ChainFlipChainId
    assetId: ChainFlipAssetId
    chain: Exclude<Chain, 'Polkadot'>
    asset: Asset
}

export interface ChainFlipConfig {
    tokenIn: Token
    tokenOut: Token
    src: ChainFlipToken
    dest: ChainFlipToken
}

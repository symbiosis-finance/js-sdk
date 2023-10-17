import { ChainId } from '../constants'
import { Token } from './token'

const GAS = (chainId: ChainId, symbol: string, iconId: number, decimals = 18) =>
    new Token({
        isNative: true,
        name: symbol,
        symbol,
        address: '',
        chainId,
        decimals,
        icons: {
            small: `https://s2.coinmarketcap.com/static/img/coins/64x64/${iconId}.png`,
            large: `https://s2.coinmarketcap.com/static/img/coins/64x64/${iconId}.png`,
        },
    })

export const GAS_TOKEN: Record<ChainId, Token> = {
    [ChainId.ETH_MAINNET]: GAS(ChainId.ETH_MAINNET, 'ETH', 1027),
    [ChainId.ETH_RINKEBY]: GAS(ChainId.ETH_RINKEBY, 'ETH', 1027),
    [ChainId.ETH_GOERLI]: GAS(ChainId.ETH_GOERLI, 'ETH', 1027),
    [ChainId.ETH_KOVAN]: GAS(ChainId.ETH_KOVAN, 'ETH', 1027),
    [ChainId.BSC_MAINNET]: GAS(ChainId.BSC_MAINNET, 'BNB', 1839),
    [ChainId.BSC_TESTNET]: GAS(ChainId.BSC_TESTNET, 'BNB', 1839),
    [ChainId.MATIC_MAINNET]: GAS(ChainId.MATIC_MAINNET, 'MATIC', 3890),
    [ChainId.MATIC_MUMBAI]: GAS(ChainId.MATIC_MUMBAI, 'MATIC', 3890),
    [ChainId.AVAX_MAINNET]: GAS(ChainId.AVAX_MAINNET, 'AVAX', 5805),
    [ChainId.AVAX_TESTNET]: GAS(ChainId.AVAX_TESTNET, 'AVAX', 5805),
    [ChainId.HECO_MAINNET]: GAS(ChainId.HECO_MAINNET, 'HT', 2502),
    [ChainId.HECO_TESTNET]: GAS(ChainId.HECO_TESTNET, 'HT', 2502),
    [ChainId.OKEX_MAINNET]: GAS(ChainId.OKEX_MAINNET, 'OKT', 8267),
    [ChainId.OKEX_TESTNET]: GAS(ChainId.OKEX_TESTNET, 'OKT', 8267),
    [ChainId.BOBA_MAINNET]: GAS(ChainId.BOBA_MAINNET, 'ETH', 1027),
    [ChainId.BOBA_RINKEBY]: GAS(ChainId.BOBA_RINKEBY, 'ETH', 1027),
    [ChainId.BOBA_BNB]: GAS(ChainId.BOBA_BNB, 'BOBA', 14556),
    [ChainId.BOBA_AVALANCHE]: GAS(ChainId.BOBA_AVALANCHE, 'BOBA', 14556),
    [ChainId.MILKOMEDA_MAINNET]: GAS(ChainId.MILKOMEDA_MAINNET, 'MilkADA', 0), // FIXME iconId
    [ChainId.MILKOMEDA_DEVNET]: GAS(ChainId.MILKOMEDA_DEVNET, 'MilktADA', 0), // FIXME iconId
    [ChainId.BTC_MAINNET]: GAS(ChainId.BTC_MAINNET, 'BTC', 1, 8),
    [ChainId.BTC_TESTNET]: GAS(ChainId.BTC_TESTNET, 'BTC', 1, 8),
    [ChainId.AURORA_MAINNET]: GAS(ChainId.AURORA_MAINNET, 'ETH', 1027),
    [ChainId.AURORA_TESTNET]: GAS(ChainId.AURORA_TESTNET, 'ETH', 1027),
    [ChainId.TELOS_MAINNET]: GAS(ChainId.TELOS_MAINNET, 'TLOS', 4660),
    [ChainId.TELOS_TESTNET]: GAS(ChainId.TELOS_TESTNET, 'TLOS', 4660),
    [ChainId.SHARDEUM_TESTNET_2]: GAS(ChainId.SHARDEUM_TESTNET_2, 'SHM', 22353),
    [ChainId.KAVA_MAINNET]: GAS(ChainId.KAVA_MAINNET, 'KAVA', 4846),
    [ChainId.SCROLL_TESTNET]: GAS(ChainId.SCROLL_TESTNET, 'ETH', 1027),
    [ChainId.SCROLL_SEPOLIA]: GAS(ChainId.SCROLL_SEPOLIA, 'ETH', 1027),
    [ChainId.ZKSYNC_MAINNET]: GAS(ChainId.ZKSYNC_MAINNET, 'ETH', 1027),
    [ChainId.ARBITRUM_MAINNET]: GAS(ChainId.ARBITRUM_MAINNET, 'ETH', 1027),
    [ChainId.ARBITRUM_NOVA]: GAS(ChainId.ARBITRUM_NOVA, 'ETH', 1027),
    [ChainId.OPTIMISM_MAINNET]: GAS(ChainId.OPTIMISM_MAINNET, 'ETH', 1027),
    [ChainId.ZETACHAIN_ATHENS_2]: GAS(ChainId.ZETACHAIN_ATHENS_2, 'ZETA', 21259),
    [ChainId.POLYGON_ZK]: GAS(ChainId.POLYGON_ZK, 'ETH', 1027),
    [ChainId.LINEA_MAINNET]: GAS(ChainId.LINEA_MAINNET, 'ETH', 1027),
    [ChainId.LINEA_TESTNET]: GAS(ChainId.LINEA_TESTNET, 'ETH', 1027),
    [ChainId.MANTLE_MAINNET]: GAS(ChainId.MANTLE_MAINNET, 'MNT', 27075),
    [ChainId.MANTLE_TESTNET]: GAS(ChainId.MANTLE_TESTNET, 'MNT', 27075),
    [ChainId.BASE_MAINNET]: GAS(ChainId.BASE_MAINNET, 'ETH', 1027),
    [ChainId.TRON_TESTNET]: GAS(ChainId.TRON_TESTNET, 'TRX', 1958, 6),
    [ChainId.TRON_MAINNET]: GAS(ChainId.TRON_MAINNET, 'TRX', 1958, 6),
    [ChainId.SCROLL_MAINNET]: GAS(ChainId.SCROLL_MAINNET, 'ETH', 1027),
}

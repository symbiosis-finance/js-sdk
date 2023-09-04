import { AddressZero } from '@ethersproject/constants'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, WETH } from '../entities'

export const CHAINS_PRIORITY = [
    ChainId.ETH_MAINNET,
    ChainId.ETH_RINKEBY,
    ChainId.ETH_KOVAN,
    ChainId.ETH_GOERLI,
    ChainId.BSC_MAINNET,
    // ChainId.BSC_TESTNET, // NOTE it is a manager chain
    ChainId.AVAX_MAINNET,
    ChainId.AVAX_TESTNET,
    ChainId.BOBA_MAINNET,
    ChainId.BOBA_AVALANCHE,
    // ChainId.BOBA_BNB, // NOTE it is a manager chain
    ChainId.BOBA_RINKEBY,
    ChainId.AURORA_MAINNET,
    ChainId.AURORA_TESTNET,
    ChainId.TELOS_MAINNET,
    ChainId.TELOS_TESTNET,
    ChainId.MATIC_MAINNET,
    ChainId.MATIC_MUMBAI,
    ChainId.MILKOMEDA_MAINNET,
    ChainId.MILKOMEDA_DEVNET,
    ChainId.OKEX_MAINNET,
    ChainId.OKEX_TESTNET,
    ChainId.HECO_MAINNET,
    ChainId.HECO_TESTNET,
    ChainId.SHARDEUM_TESTNET_2,
    ChainId.KAVA_MAINNET,
    ChainId.SCROLL_TESTNET,
    ChainId.SCROLL_SEPOLIA,
    ChainId.ZKSYNC_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.ARBITRUM_NOVA,
    ChainId.OPTIMISM_MAINNET,
    ChainId.ZETACHAIN_ATHENS_2,
    ChainId.POLYGON_ZK,
    ChainId.TRON_MAINNET,
    ChainId.TRON_TESTNET,
    ChainId.LINEA_TESTNET,
    ChainId.LINEA_MAINNET,
    ChainId.MANTLE_MAINNET,
    ChainId.MANTLE_TESTNET,
    ChainId.BASE_MAINNET,
]

// a list of tokens by chain
type ChainTokensList = {
    readonly [chainId in ChainId]?: Token[]
}

export const ONE_INCH_CHAINS: ChainId[] = [
    ChainId.ETH_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.ZKSYNC_MAINNET,
    ChainId.BASE_MAINNET,
]

export const ONE_INCH_ORACLE_MAP: { [chainId in ChainId]?: string } = {
    [ChainId.ETH_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.BSC_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.MATIC_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.OPTIMISM_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.ARBITRUM_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.AVAX_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
    [ChainId.ZKSYNC_MAINNET]: '0xC762d56614D3411eC6fABD56cb075D904b801613',
    [ChainId.BASE_MAINNET]: '0x52cbE0f49CcdD4Dc6E9C13BAb024EABD2842045B',
}

export const WETH_ONLY: ChainTokensList = {
    [ChainId.ETH_MAINNET]: [WETH[ChainId.ETH_MAINNET]],
    [ChainId.ETH_RINKEBY]: [WETH[ChainId.ETH_RINKEBY]],
    [ChainId.ETH_GOERLI]: [WETH[ChainId.ETH_GOERLI]],
    [ChainId.ETH_KOVAN]: [WETH[ChainId.ETH_KOVAN]],
    [ChainId.BSC_MAINNET]: [WETH[ChainId.BSC_MAINNET]],
    [ChainId.BSC_TESTNET]: [WETH[ChainId.BSC_TESTNET]],
    [ChainId.MATIC_MAINNET]: [WETH[ChainId.MATIC_MAINNET]],
    [ChainId.MATIC_MUMBAI]: [WETH[ChainId.MATIC_MUMBAI]],
    [ChainId.AVAX_MAINNET]: [WETH[ChainId.AVAX_MAINNET]],
    [ChainId.AVAX_TESTNET]: [WETH[ChainId.AVAX_TESTNET]],
    [ChainId.HECO_MAINNET]: [WETH[ChainId.HECO_MAINNET]],
    [ChainId.HECO_TESTNET]: [WETH[ChainId.HECO_TESTNET]],
    [ChainId.OKEX_MAINNET]: [WETH[ChainId.OKEX_MAINNET]],
    [ChainId.OKEX_TESTNET]: [WETH[ChainId.OKEX_TESTNET]],
    [ChainId.BOBA_MAINNET]: [WETH[ChainId.BOBA_MAINNET]],
    [ChainId.BOBA_AVALANCHE]: [WETH[ChainId.BOBA_AVALANCHE]],
    [ChainId.BOBA_BNB]: [WETH[ChainId.BOBA_BNB]],
    [ChainId.BOBA_RINKEBY]: [WETH[ChainId.BOBA_RINKEBY]],
    [ChainId.MILKOMEDA_MAINNET]: [WETH[ChainId.MILKOMEDA_MAINNET]],
    [ChainId.MILKOMEDA_DEVNET]: [WETH[ChainId.MILKOMEDA_DEVNET]],
    [ChainId.AURORA_MAINNET]: [WETH[ChainId.AURORA_MAINNET]],
    [ChainId.AURORA_TESTNET]: [WETH[ChainId.AURORA_TESTNET]],
    [ChainId.TELOS_MAINNET]: [WETH[ChainId.TELOS_MAINNET]],
    [ChainId.TELOS_TESTNET]: [WETH[ChainId.TELOS_TESTNET]],
    [ChainId.SHARDEUM_TESTNET_2]: [WETH[ChainId.SHARDEUM_TESTNET_2]],
    [ChainId.KAVA_MAINNET]: [WETH[ChainId.KAVA_MAINNET]],
    [ChainId.SCROLL_TESTNET]: [WETH[ChainId.SCROLL_TESTNET]],
    [ChainId.SCROLL_SEPOLIA]: [WETH[ChainId.SCROLL_SEPOLIA]],
    [ChainId.ZKSYNC_MAINNET]: [WETH[ChainId.ZKSYNC_MAINNET]],
    [ChainId.ARBITRUM_MAINNET]: [WETH[ChainId.ARBITRUM_MAINNET]],
    [ChainId.ARBITRUM_NOVA]: [WETH[ChainId.ARBITRUM_NOVA]],
    [ChainId.OPTIMISM_MAINNET]: [WETH[ChainId.OPTIMISM_MAINNET]],
    [ChainId.ZETACHAIN_ATHENS_2]: [WETH[ChainId.ZETACHAIN_ATHENS_2]],
    [ChainId.POLYGON_ZK]: [WETH[ChainId.POLYGON_ZK]],
    [ChainId.LINEA_TESTNET]: [WETH[ChainId.LINEA_TESTNET]],
    [ChainId.LINEA_MAINNET]: [WETH[ChainId.LINEA_MAINNET]],
    [ChainId.MANTLE_MAINNET]: [WETH[ChainId.MANTLE_MAINNET]],
    [ChainId.MANTLE_TESTNET]: [WETH[ChainId.MANTLE_TESTNET]],
    [ChainId.BASE_MAINNET]: [WETH[ChainId.BASE_MAINNET]],
}

export const DEX_TOKENS_TO_CHECK_TRADES_AGAINST = {
    [ChainId.ETH_MAINNET]: [
        new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            decimals: 18,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
        }),
        new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD//C',
        }),
        new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            decimals: 6,
            symbol: 'USDT',
            name: 'Tether USD',
        }),
        // new Token({
        //     chainId: ChainId.ETH_MAINNET,
        //     address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        //     decimals: 8,
        //     symbol: 'WBTC',
        //     name: 'Wrapped BTC',
        // }),
    ],
    [ChainId.BSC_MAINNET]: [
        // new Token({
        //     chainId: ChainId.BSC_MAINNET,
        //     address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        //     decimals: 18,
        //     symbol: 'CAKE',
        //     name: 'PancakeSwap Token',
        // }),
        new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
            decimals: 18,
            symbol: 'BUSD',
            name: 'Binance USD',
        }),
        new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x55d398326f99059fF775485246999027B3197955',
            decimals: 18,
            symbol: 'USDT',
            name: 'Tether USD',
        }),
        // new Token({
        //     chainId: ChainId.BSC_MAINNET,
        //     address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        //     decimals: 18,
        //     symbol: 'BTCB',
        //     name: 'Binance BTC',
        // }),
        // new Token({
        //     chainId: ChainId.BSC_MAINNET,
        //     address: '0x23396cF899Ca06c4472205fC903bDB4de249D6fC',
        //     decimals: 18,
        //     symbol: 'UST',
        //     name: 'Wrapped UST Token',
        // }),
        // new Token({
        //     chainId: ChainId.BSC_MAINNET,
        //     address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        //     decimals: 18,
        //     symbol: 'ETH',
        //     name: 'Binance-Peg Ethereum Token',
        // }),
        new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
            decimals: 18,
            symbol: 'USDC',
            name: 'Binance-Peg USD Coin',
        }),
    ],
    [ChainId.AVAX_MAINNET]: [
        // new Token({
        //     chainId: ChainId.AVAX_MAINNET,
        //     address: '0x60781C2586D68229fde47564546784ab3fACA982',
        //     decimals: 18,
        //     symbol: 'PNG',
        //     name: 'Pangolin',
        // }),
        new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118',
            decimals: 6,
            symbol: 'USDT.e',
            name: 'Tether USD',
        }),
        new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70',
            decimals: 18,
            symbol: 'DAI.e',
            name: 'Dai Stablecoin',
        }),
        new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664',
            decimals: 6,
            symbol: 'USDC.e',
            name: 'USD Coin',
        }),
        // new Token({
        //     chainId: ChainId.AVAX_MAINNET,
        //     address: '0x260Bbf5698121EB85e7a74f2E45E16Ce762EbE11',
        //     decimals: 6,
        //     symbol: 'UST',
        //     name: 'Axelar Wrapped UST',
        // }),
        new Token({
            chainId: ChainId.AVAX_MAINNET,
            address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.MATIC_MAINNET]: [
        new Token({
            chainId: ChainId.MATIC_MAINNET,
            address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
            decimals: 6,
            symbol: 'USDC',
            name: 'USDC',
        }),
        new Token({
            chainId: ChainId.MATIC_MAINNET,
            address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            decimals: 6,
            symbol: 'USDT',
            name: 'Tether USD',
        }),
        // new Token({
        //     chainId: ChainId.MATIC_MAINNET,
        //     address: '0x831753DD7087CaC61aB5644b308642cc1c33Dc13',
        //     decimals: 18,
        //     symbol: 'QUICK',
        //     name: 'QuickSwap',
        // }),
        // new Token({
        //     chainId: ChainId.MATIC_MAINNET,
        //     address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        //     decimals: 18,
        //     symbol: 'ETH',
        //     name: 'Ether',
        // }),
        new Token({
            chainId: ChainId.MATIC_MAINNET,
            address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
            decimals: 18,
            symbol: 'wBTC',
            name: 'Wrapped Bitcoin',
        }),
        new Token({
            chainId: ChainId.MATIC_MAINNET,
            address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
            decimals: 18,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
        }),
    ],
    [ChainId.BOBA_AVALANCHE]: [],
    [ChainId.BOBA_BNB]: [],
    [ChainId.BOBA_MAINNET]: [
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            symbol: 'DAI',
            name: 'Dai Stablecoin',
            address: '0xf74195Bb8a5cf652411867c5C2C5b8C2a402be35',
            decimals: 18,
        }),
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            symbol: 'WBTC',
            name: 'Wrapped BTC',
            address: '0xdc0486f8bf31DF57a952bcd3c1d3e166e3d9eC8b',
            decimals: 8,
        }),
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            name: 'USD Coin',
            address: '0x66a2A913e447d6b4BF33EFbec43aAeF87890FBbc',
            symbol: 'USDC',
            decimals: 6,
        }),
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            symbol: 'USDT',
            name: 'Tether USD',
            address: '0x5DE1677344D3Cb0D7D465c10b72A8f60699C062d',
            decimals: 6,
        }),
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            symbol: 'BOBA',
            name: 'Boba Token',
            address: '0xa18bF3994C0Cc6E3b63ac420308E5383f53120D7',
            decimals: 18,
        }),
        new Token({
            chainId: ChainId.BOBA_MAINNET,
            symbol: 'OLO',
            name: 'OolongSwap Token',
            address: '0x5008F837883EA9a07271a1b5eB0658404F5a9610',
            decimals: 18,
        }),
    ],
    [ChainId.MILKOMEDA_MAINNET]: [
        new Token({
            chainId: ChainId.MILKOMEDA_MAINNET,
            symbol: 'sUSDC',
            name: 'USDC from Ethereum',
            address: '0x42110A5133F91B49E32B671Db86E2C44Edc13832',
            decimals: 6,
        }),
        new Token({
            chainId: ChainId.MILKOMEDA_MAINNET,
            symbol: 'SIS',
            name: 'SIS from Ethereum',
            address: '0xedd4D7DAa6bf8746997CEbbF974a60B838757601',
            decimals: 18,
        }),
    ],
    [ChainId.AURORA_MAINNET]: [
        new Token({
            chainId: ChainId.AURORA_MAINNET,
            symbol: 'USDC',
            name: 'USD Coin',
            address: '0xB12BFcA5A55806AaF64E99521918A4bf0fC40802',
            decimals: 6,
        }),
        new Token({
            chainId: ChainId.AURORA_MAINNET,
            symbol: 'USDT',
            name: 'Tether USD',
            address: '0x4988a896b1227218e4A686fdE5EabdcAbd91571f',
            decimals: 6,
        }),
        new Token({
            chainId: ChainId.AURORA_MAINNET,
            symbol: 'wNEAR',
            name: 'Wrapped NEAR',
            address: '0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d',
            decimals: 24,
        }),
        new Token({
            chainId: ChainId.AURORA_MAINNET,
            symbol: 'AURORA',
            name: 'AURORA',
            address: '0x8BEc47865aDe3B172A928df8f990Bc7f2A3b9f79',
            decimals: 18,
        }),
    ],
    [ChainId.KAVA_MAINNET]: [
        new Token({
            chainId: ChainId.KAVA_MAINNET,
            address: '0xfA9343C3897324496A05fC75abeD6bAC29f8A40f',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.SCROLL_TESTNET]: [],
    [ChainId.SCROLL_SEPOLIA]: [],
    [ChainId.ZKSYNC_MAINNET]: [
        new Token({
            chainId: ChainId.ZKSYNC_MAINNET,
            address: '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.ARBITRUM_MAINNET]: [
        new Token({
            chainId: ChainId.ARBITRUM_MAINNET,
            address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.ARBITRUM_NOVA]: [
        new Token({
            chainId: ChainId.ARBITRUM_NOVA,
            address: '0x750ba8b76187092B0D1E87E28daaf484d1b5273b',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.OPTIMISM_MAINNET]: [
        new Token({
            chainId: ChainId.OPTIMISM_MAINNET,
            address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            decimals: 6,
            symbol: 'USDC',
            name: 'USD Coin',
        }),
    ],
    [ChainId.ZETACHAIN_ATHENS_2]: [],
    [ChainId.POLYGON_ZK]: [],
    [ChainId.TRON_TESTNET]: [
        new Token({
            chainId: ChainId.TRON_TESTNET,
            address: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
            decimals: 6,
            symbol: 'USDT',
            name: 'Tether USD',
        }),
    ],
    [ChainId.LINEA_TESTNET]: [],
    [ChainId.LINEA_MAINNET]: [],
    [ChainId.MANTLE_MAINNET]: [],
    [ChainId.MANTLE_TESTNET]: [],
    [ChainId.BASE_MAINNET]: [],
}

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST: ChainTokensList = {
    ...WETH_ONLY,
    [ChainId.ETH_MAINNET]: [WETH[ChainId.ETH_MAINNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.ETH_MAINNET]],
    [ChainId.BSC_MAINNET]: [WETH[ChainId.BSC_MAINNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.BSC_MAINNET]],
    [ChainId.AVAX_MAINNET]: [WETH[ChainId.AVAX_MAINNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.AVAX_MAINNET]],
    [ChainId.MATIC_MAINNET]: [
        WETH[ChainId.MATIC_MAINNET],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.MATIC_MAINNET],
    ],
    [ChainId.BOBA_MAINNET]: [WETH[ChainId.BOBA_MAINNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.BOBA_MAINNET]],
    [ChainId.BOBA_AVALANCHE]: [
        WETH[ChainId.BOBA_AVALANCHE],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.BOBA_AVALANCHE],
    ],
    [ChainId.BOBA_BNB]: [WETH[ChainId.BOBA_BNB], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.BOBA_BNB]],
    [ChainId.AURORA_MAINNET]: [
        WETH[ChainId.AURORA_MAINNET],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.AURORA_MAINNET],
    ],
    [ChainId.KAVA_MAINNET]: [WETH[ChainId.KAVA_MAINNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.KAVA_MAINNET]],
    [ChainId.ZKSYNC_MAINNET]: [
        WETH[ChainId.ZKSYNC_MAINNET],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.ZKSYNC_MAINNET],
    ],
    [ChainId.ARBITRUM_MAINNET]: [
        WETH[ChainId.ARBITRUM_MAINNET],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.ARBITRUM_MAINNET],
    ],
    [ChainId.ARBITRUM_NOVA]: [
        WETH[ChainId.ARBITRUM_NOVA],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.ARBITRUM_NOVA],
    ],
    [ChainId.OPTIMISM_MAINNET]: [
        WETH[ChainId.OPTIMISM_MAINNET],
        ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.OPTIMISM_MAINNET],
    ],
    [ChainId.POLYGON_ZK]: [WETH[ChainId.POLYGON_ZK], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.POLYGON_ZK]],
    [ChainId.TRON_TESTNET]: [WETH[ChainId.TRON_TESTNET], ...DEX_TOKENS_TO_CHECK_TRADES_AGAINST[ChainId.TRON_TESTNET]],
}

/**
 * Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
 * tokens.
 */
export const CUSTOM_BASES: {
    [chainId in ChainId]?: { [tokenAddress: string]: Token[] }
} = {
    [ChainId.BSC_MAINNET]: {},
}

// one basis point
export const ONE_BIPS = new Percent(JSBI.BigInt(1), JSBI.BigInt(10000))
export const BIPS_BASE = JSBI.BigInt(10000)

// Multicall2 addresses (tryAggregate method required)
export const MULTICALL_ADDRESSES: { [chainId in ChainId]?: string } = {
    [ChainId.ETH_MAINNET]: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    [ChainId.ETH_RINKEBY]: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    [ChainId.ETH_GOERLI]: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    [ChainId.ETH_KOVAN]: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    [ChainId.BSC_MAINNET]: '0xfF6FD90A470Aaa0c1B8A54681746b07AcdFedc9B',
    [ChainId.BSC_TESTNET]: '0xbC4F726A6dB460DcFE49E6a56886470B94Dfc302',
    [ChainId.MATIC_MAINNET]: '0x275617327c958bD06b5D6b871E7f491D76113dd8',
    [ChainId.MATIC_MUMBAI]: '0xe9939e7Ea7D7fb619Ac57f648Da7B1D425832631',
    [ChainId.AVAX_MAINNET]: '0x29b6603d17b9d8f021ecb8845b6fd06e1adf89de',
    [ChainId.AVAX_TESTNET]: '0x9A9b5Ef5CeAbaC69d3B4A71c4da782554A35B638',
    [ChainId.HECO_MAINNET]: AddressZero, // TODO
    [ChainId.HECO_TESTNET]: '0x9a9b5ef5ceabac69d3b4a71c4da782554a35b638',
    [ChainId.OKEX_MAINNET]: AddressZero, // TODO
    [ChainId.OKEX_TESTNET]: '0x9A9b5Ef5CeAbaC69d3B4A71c4da782554A35B638',
    [ChainId.BOBA_MAINNET]: '0xaeD5b25BE1c3163c907a471082640450F928DDFE',
    [ChainId.BOBA_AVALANCHE]: '0x92C5b5B66988E6B8931a8CD3faa418b42003DF2F',
    [ChainId.BOBA_BNB]: '0x31cCe73DA4365342bd081F6a748AAdb7c7a49b7E',
    [ChainId.BOBA_RINKEBY]: '0x773ccf8ba321c9f96a100b4b0fa1ecf7046645f5',
    [ChainId.MILKOMEDA_MAINNET]: '0xa46157Cda2D019Ba4cDcd8cE12A04760c15C355b',
    [ChainId.MILKOMEDA_DEVNET]: '0x41b5984f45AfB2560a0ED72bB69A98E8b32B3cCA',
    [ChainId.AURORA_MAINNET]: '0xbf69a56d35b8d6f5a8e0e96b245a72f735751e54',
    [ChainId.AURORA_TESTNET]: '0x4a5143B13C84DB00E6d8c19b9EA00f3b91416d20',
    [ChainId.TELOS_MAINNET]: '0x53dC7535028e2fcaCa0d847AD108b9240C0801b1',
    [ChainId.TELOS_TESTNET]: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
    [ChainId.SHARDEUM_TESTNET_2]: '0x41b5984f45AfB2560a0ED72bB69A98E8b32B3cCA',
    [ChainId.KAVA_MAINNET]: '0x30A62aA52Fa099C4B227869EB6aeaDEda054d121',
    [ChainId.SCROLL_TESTNET]: '0x41b5984f45AfB2560a0ED72bB69A98E8b32B3cCA',
    [ChainId.SCROLL_SEPOLIA]: '0xF3Cfa393be621097669BcD2bD4923CEC347E1210',
    [ChainId.ZKSYNC_MAINNET]: '0x52192C3De01535a9Ad2743A5Fe4f774868103C20',
    [ChainId.ARBITRUM_MAINNET]: '0x80c7dd17b01855a6d2347444a0fcc36136a314de',
    [ChainId.ARBITRUM_NOVA]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.OPTIMISM_MAINNET]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.ZETACHAIN_ATHENS_2]: '0x9a01bf917477dD9F5D715D188618fc8B7350cd22',
    [ChainId.POLYGON_ZK]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.TRON_TESTNET]: '0x00e08cb2cd7480ddf6c54430207dff81ce359887',
    [ChainId.LINEA_TESTNET]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.LINEA_MAINNET]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.MANTLE_MAINNET]: '0xb55cc6B5B402437b66c13c0CEd0EF367aa7c26da',
    [ChainId.MANTLE_TESTNET]: '0xcA11bde05977b3631167028862bE2a173976CA11',
    [ChainId.BASE_MAINNET]: '0xcA11bde05977b3631167028862bE2a173976CA11',
}

import { AddressZero } from '@ethersproject/constants'
import JSBI from 'jsbi'
import { ChainId } from '../constants'
import { Percent, Token, WETH } from '../entities'

export const CHAINS_PRIORITY = [
    ChainId.ETH_MAINNET,
    ChainId.ETH_RINKEBY,
    ChainId.BSC_MAINNET,
    ChainId.BSC_TESTNET,
    ChainId.AVAX_MAINNET,
    ChainId.AVAX_TESTNET,
    ChainId.BOBA_MAINNET,
    ChainId.BOBA_RINKEBY,
    ChainId.MATIC_MAINNET,
    ChainId.MATIC_MUMBAI,
    ChainId.OKEX_MAINNET,
    ChainId.OKEX_TESTNET,
    ChainId.HECO_MAINNET,
    ChainId.HECO_TESTNET,
]

// a list of tokens by chain
type ChainTokensList = {
    readonly [chainId in ChainId]?: Token[]
}

export const WETH_ONLY: ChainTokensList = {
    [ChainId.ETH_MAINNET]: [WETH[ChainId.ETH_MAINNET]],
    [ChainId.ETH_RINKEBY]: [WETH[ChainId.ETH_RINKEBY]],
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
    [ChainId.BOBA_RINKEBY]: [WETH[ChainId.BOBA_RINKEBY]],
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
    [ChainId.BOBA_MAINNET]: []
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
    [ChainId.BOBA_RINKEBY]: '0x773ccf8ba321c9f96a100b4b0fa1ecf7046645f5',
}

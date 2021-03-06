import { ChainConstructor, ChainId, Icons } from '../constants'

export class Chain {
    public readonly id: ChainId
    public readonly name: string
    public readonly disabled: boolean
    public readonly swappable: boolean
    public readonly evm: boolean
    public readonly explorer: string
    public readonly icons: Icons

    constructor(params: ChainConstructor) {
        this.id = params.id
        this.name = params.name
        this.disabled = params.disabled
        this.explorer = params.explorer
        this.icons = params.icons
        this.swappable = params?.swappable !== false
        this.evm = params?.evm !== false
    }
}

export const chains: Chain[] = [
    new Chain({
        id: ChainId.BTC_MAINNET,
        name: 'Bitcoin',
        disabled: false,
        explorer: 'https://www.blockchain.com/btc',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.BTC_TESTNET,
        name: 'Bitcoin',
        disabled: false,
        explorer: 'https://www.blockchain.com/btc-testnet',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.ETH_MAINNET,
        name: 'Ethereum',
        disabled: false,
        explorer: 'https://etherscan.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.ETH_RINKEBY,
        name: 'Rinkeby',
        disabled: false,
        explorer: 'https://rinkeby.etherscan.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.ETH_KOVAN,
        name: 'Kovan',
        disabled: false,
        explorer: 'https://kovan.etherscan.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.BSC_MAINNET,
        name: 'BNB',
        disabled: false,
        explorer: 'https://bscscan.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.BSC_TESTNET,
        name: 'BNB',
        disabled: false,
        explorer: 'https://testnet.bscscan.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.MATIC_MAINNET,
        name: 'Polygon',
        disabled: false,
        explorer: 'https://polygonscan.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.MATIC_MUMBAI,
        name: 'Mumbai', // Polygon Testnet
        disabled: false,
        explorer: 'https://mumbai.polygonscan.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.AVAX_MAINNET,
        name: 'Avalanche',
        disabled: false,
        explorer: 'https://snowtrace.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.AVAX_TESTNET,
        name: 'Fuji',
        disabled: false,
        explorer: 'https://testnet.snowtrace.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchex/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.HECO_MAINNET,
        name: 'HECO',
        disabled: false,
        explorer: 'https://hecoinfo.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/heco/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/heco/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.HECO_TESTNET,
        name: 'HECO',
        disabled: false,
        explorer: 'https://testnet.hecoinfo.com',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/heco/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/heco/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.OKEX_MAINNET,
        name: 'OEC',
        disabled: false,
        explorer: 'https://www.oklink.com/oec',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
            large: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
        },
    }),
    new Chain({
        id: ChainId.OKEX_TESTNET,
        name: 'OEC',
        disabled: false,
        explorer: 'https://www.oklink.com/oec-test',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
            large: 'https://s2.coinmarketcap.com/static/img/exchanges/64x64/294.png',
        },
    }),
    new Chain({
        id: ChainId.BOBA_MAINNET,
        name: 'Boba',
        disabled: false,
        explorer: 'https://blockexplorer.boba.network',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
        },
    }),
    new Chain({
        id: ChainId.BOBA_RINKEBY,
        name: 'Boba',
        disabled: false,
        explorer: 'https://blockexplorer.rinkeby.boba.network',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14556.png',
        },
    }),
    new Chain({
        id: ChainId.MILKOMEDA_MAINNET,
        name: 'Milkomeda',
        disabled: false,
        explorer: 'https://explorer-mainnet-cardano-evm.c1.milkomeda.com',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/milkomeda/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/milkomeda/logo.png',
        },
    }),
    new Chain({
        id: ChainId.MILKOMEDA_DEVNET,
        name: 'Milkomeda',
        disabled: false,
        explorer: 'https://explorer-devnet-cardano-evm.c1.milkomeda.com',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/milkomeda/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/milkomeda/logo.png',
        },
    }),
]

export const getChainById = (chainId: ChainId | undefined): Chain | undefined => {
    if (!chainId) return undefined
    return chains.find((chain) => chain.id === chainId)
}

import { ChainId, type ChainConstructor, type Icons } from '../constants'

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
        id: ChainId.TON_MAINNET,
        name: 'TON',
        disabled: false,
        explorer: 'https://tonviewer.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.TON_TESTNET,
        name: 'TON',
        disabled: false,
        explorer: 'https://testnet.tonviewer.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.BTC_MAINNET,
        name: 'Bitcoin',
        disabled: false,
        explorer: 'https://mempool.space',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.BTC_MUTINY,
        name: 'Bitcoin Mutiny',
        disabled: false,
        explorer: 'https://mutinynet.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.BTC_TESTNET4,
        name: 'Bitcoin Testnet4',
        disabled: false,
        explorer: 'https://mempool.space/testnet4',
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
        name: 'Boba Ethereum',
        disabled: false,
        explorer: 'https://eth.bobascan.com',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-ethereum/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-ethereum/logo.png',
        },
    }),
    new Chain({
        id: ChainId.BOBA_RINKEBY,
        name: 'Boba Rinkeby',
        disabled: false,
        explorer: 'https://blockexplorer.rinkeby.boba.network',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-ethereum/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-ethereum/logo.png',
        },
    }),
    new Chain({
        id: ChainId.BOBA_AVALANCHE,
        name: 'Boba Avalanche',
        disabled: false,
        explorer: 'https://blockexplorer.avax.boba.network',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-avalanche/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/boba-avalanche/logo.png',
        },
    }),
    new Chain({
        id: ChainId.SYMBIOSIS_TESTNET,
        name: 'Symbiosis Testnet',
        disabled: false,
        explorer: 'https://symbiosis-nitro-testnet.explorer.caldera.xyz',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/15084.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/15084.png',
        },
    }),
    new Chain({
        id: ChainId.SYMBIOSIS_MAINNET,
        name: 'Symbiosis',
        disabled: false,
        explorer: 'https://symbiosis.calderaexplorer.xyz',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/15084.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/15084.png',
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
    new Chain({
        id: ChainId.AURORA_MAINNET,
        name: 'Aurora',
        disabled: false,
        explorer: 'https://aurorascan.dev',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14803.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14803.png',
        },
    }),
    new Chain({
        id: ChainId.AURORA_TESTNET,
        name: 'Aurora',
        disabled: false,
        explorer: 'https://testnet.aurorascan.dev',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14803.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/14803.png',
        },
    }),
    new Chain({
        id: ChainId.TELOS_MAINNET,
        name: 'Telos',
        disabled: false,
        explorer: 'https://teloscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4660.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4660.png',
        },
    }),
    new Chain({
        id: ChainId.TELOS_TESTNET,
        name: 'Telos',
        disabled: false,
        explorer: 'https://testnet.teloscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4660.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4660.png',
        },
    }),
    new Chain({
        id: ChainId.SHARDEUM_TESTNET_2,
        name: 'Shardeum Liberty 2.X',
        disabled: false,
        explorer: 'https://explorer-liberty20.shardeum.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22353.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22353.png',
        },
    }),
    new Chain({
        id: ChainId.KAVA_MAINNET,
        name: 'KAVA EVM',
        disabled: false,
        explorer: 'https://explorer.kava.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4846.png',
        },
    }),
    new Chain({
        id: ChainId.SCROLL_SEPOLIA,
        name: 'Scroll Sepolia',
        disabled: false,
        explorer: 'https://scroll-sepolia.l2scan.co',
        icons: {
            small: 'https://res.cloudinary.com/dzkjyvmsn/image/upload/v1680688496/scroll_p8h6bl.png',
            large: 'https://res.cloudinary.com/dzkjyvmsn/image/upload/v1680688496/scroll_p8h6bl.png',
        },
    }),
    new Chain({
        id: ChainId.ZKSYNC_MAINNET,
        name: 'ZkSync Era',
        disabled: false,
        explorer: 'https://era.zksync.network',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24091.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24091.png',
        },
    }),
    new Chain({
        id: ChainId.ARBITRUM_MAINNET,
        name: 'Arbitrum One',
        disabled: false,
        explorer: 'https://arbiscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png',
        },
    }),
    new Chain({
        id: ChainId.ARBITRUM_NOVA,
        name: 'Arbitrum Nova',
        disabled: false,
        explorer: 'https://nova.arbiscan.io',
        icons: {
            small: 'https://l2beat.com/icons/nova.png',
            large: 'https://l2beat.com/icons/nova.png',
        },
    }),
    new Chain({
        id: ChainId.OPTIMISM_MAINNET,
        name: 'Optimism',
        disabled: false,
        explorer: 'https://optimistic.etherscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png',
        },
    }),
    new Chain({
        id: ChainId.ZETACHAIN_ATHENS_2,
        name: 'ZetaChain',
        disabled: false,
        explorer: 'https://explorer.zetachain.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
        },
    }),
    new Chain({
        id: ChainId.POLYGON_ZK,
        name: 'Polygon zkEVM',
        disabled: false,
        explorer: 'https://zkevm.polygonscan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png',
        },
    }),
    new Chain({
        id: ChainId.TRON_MAINNET,
        name: 'Tron',
        disabled: false,
        explorer: 'https://tronscan.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.TRON_TESTNET,
        name: 'Tron Testnet',
        disabled: false,
        explorer: 'https://shasta.tronscan.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1958.png',
        },
        evm: false,
    }),
    new Chain({
        id: ChainId.LINEA_TESTNET,
        name: 'Linea',
        disabled: false,
        explorer: 'https://goerli.lineascan.build',
        icons: {
            small: 'https://l2beat.com/icons/linea.png',
            large: 'https://l2beat.com/icons/linea.png',
        },
    }),
    new Chain({
        id: ChainId.LINEA_MAINNET,
        name: 'Linea',
        disabled: false,
        explorer: 'https://lineascan.build',
        icons: {
            small: 'https://l2beat.com/icons/linea.png',
            large: 'https://l2beat.com/icons/linea.png',
        },
    }),
    new Chain({
        id: ChainId.MANTLE_MAINNET,
        name: 'Mantle',
        disabled: false,
        explorer: 'https://explorer.mantle.xyz',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
        },
    }),
    new Chain({
        id: ChainId.MANTLE_TESTNET,
        name: 'Mantle',
        disabled: false,
        explorer: 'https://explorer.testnet.mantle.xyz',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/27075.png',
        },
    }),
    new Chain({
        id: ChainId.BASE_MAINNET,
        name: 'Base',
        disabled: false,
        explorer: 'https://basescan.org',
        icons: {
            small: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/base/logo.png',
            large: 'https://raw.githubusercontent.com/allush/assets/main/images/blockchains/base/logo.png',
        },
    }),
    new Chain({
        id: ChainId.SCROLL_MAINNET,
        name: 'Scroll',
        disabled: false,
        explorer: 'https://scrollscan.com',
        icons: {
            small: 'https://res.cloudinary.com/dzkjyvmsn/image/upload/v1680688496/scroll_p8h6bl.png',
            large: 'https://res.cloudinary.com/dzkjyvmsn/image/upload/v1680688496/scroll_p8h6bl.png',
        },
    }),
    new Chain({
        id: ChainId.MANTA_MAINNET,
        name: 'Manta',
        disabled: false,
        explorer: 'https://pacific-explorer.manta.network',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/13631.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/128x128/13631.png',
        },
    }),
    new Chain({
        id: ChainId.METIS_MAINNET,
        name: 'Metis',
        disabled: false,
        explorer: 'https://explorer.metis.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/9640.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/128x128/9640.png',
        },
    }),
    new Chain({
        id: ChainId.OKX_X1_TESTNET,
        name: 'OKX X1 Testnet',
        disabled: false,
        explorer: 'https://www.oklink.com/x1-test',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3897.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3897.png',
        },
    }),
    new Chain({
        id: ChainId.BAHAMUT_MAINNET,
        name: 'Bahamut',
        disabled: false,
        explorer: 'https://www.ftnscan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22615.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/22615.png',
        },
    }),
    new Chain({
        id: ChainId.MODE_MAINNET,
        name: 'Mode',
        disabled: false,
        explorer: 'https://explorer.mode.network',
        icons: {
            small: 'https://assets-global.website-files.com/64c906a6ed3c4d809558853b/64d0b081f0331ac3c64c5e4d_flav.png',
            large: 'https://assets-global.website-files.com/64c906a6ed3c4d809558853b/64d0b081f0331ac3c64c5e4d_flav.png',
        },
    }),
    new Chain({
        id: ChainId.RSK_MAINNET,
        name: 'Rootstock',
        disabled: false,
        explorer: 'https://rootstock.blockscout.com',
        icons: {
            small: 'https://rootstock.blockscout.com/assets/favicon/favicon.ico',
            large: 'https://rootstock.blockscout.com/assets/favicon/favicon.ico',
        },
    }),
    new Chain({
        id: ChainId.BLAST_MAINNET,
        name: 'Blast',
        disabled: false,
        explorer: 'https://blastscan.io',
        icons: {
            small: 'https://assets.coingecko.com/coins/images/35494/standard/blast2.jpeg?1708919600',
            large: 'https://assets.coingecko.com/coins/images/35494/standard/blast2.jpeg?1708919600',
        },
    }),
    new Chain({
        id: ChainId.MERLIN_MAINNET,
        name: 'Merlin',
        disabled: false,
        explorer: 'https://scan.merlinchain.io',
        icons: {
            small: 'https://assets.coingecko.com/asset_platforms/images/188/small/merlin-chain.jpeg?1708522313',
            large: 'https://assets.coingecko.com/asset_platforms/images/188/small/merlin-chain.jpeg?1708522313',
        },
    }),
    new Chain({
        id: ChainId.ZKLINK_MAINNET,
        name: 'ZkLink',
        disabled: false,
        explorer: 'https://explorer.zklink.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/13039.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/13039.png',
        },
    }),
    new Chain({
        id: ChainId.SEPOLIA_TESTNET,
        name: 'Sepolia',
        disabled: false,
        explorer: 'https://sepolia.etherscan.io',
        icons: {
            small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
            large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
        },
    }),
    new Chain({
        id: ChainId.CORE_MAINNET,
        name: 'CORE',
        disabled: false,
        explorer: 'https://scan.coredao.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23254.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23254.png',
        },
    }),
    new Chain({
        id: ChainId.TAIKO_MAINNET,
        name: 'Taiko',
        disabled: false,
        explorer: 'https://taikoscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/31525.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/31525.png',
        },
    }),
    new Chain({
        id: ChainId.SEI_EVM_MAINNET,
        name: 'Sei v2',
        disabled: false,
        explorer: 'https://seitrace.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23149.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/23149.png',
        },
    }),
    new Chain({
        id: ChainId.ZETACHAIN_MAINNET,
        name: 'ZetaChain',
        disabled: false,
        explorer: 'https://zetachain.blockscout.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/21259.png',
        },
    }),
    new Chain({
        id: ChainId.CRONOS_MAINNET,
        name: 'Cronos',
        disabled: false,
        explorer: 'https://cronoscan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3635.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3635.png',
        },
    }),
    new Chain({
        id: ChainId.FRAXTAL_MAINNET,
        name: 'Fraxtal',
        disabled: false,
        explorer: 'https://fraxscan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6952.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/6952.png',
        },
    }),
    new Chain({
        id: ChainId.GRAVITY_MAINNET,
        name: 'Gravity',
        disabled: false,
        explorer: 'https://explorer.gravity.xyz',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32120.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32120.png',
        },
    }),
    new Chain({
        id: ChainId.BSQUARED_MAINNET,
        name: 'B² Network',
        disabled: false,
        explorer: 'https://explorer.bsquared.network',
        icons: {
            small: 'https://coin-images.coingecko.com/asset_platforms/images/239/small/bsquared-network.jpeg?1713432732',
            large: 'https://coin-images.coingecko.com/asset_platforms/images/239/small/bsquared-network.jpeg?1713432732',
        },
    }),
    new Chain({
        id: ChainId.CRONOS_ZK_MAINNET,
        name: 'Cronos zkEVM',
        disabled: false,
        explorer: 'https://explorer.zkevm.cronos.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/33873.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/33873.png',
        },
    }),
    new Chain({
        id: ChainId.MORPH_MAINNET,
        name: 'Morph',
        disabled: false,
        explorer: 'https://explorer.morphl2.io',
        icons: {
            small: 'https://coin-images.coingecko.com/asset_platforms/images/22185/small/morph.jpg?1729659940',
            large: 'https://coin-images.coingecko.com/asset_platforms/images/22185/small/morph.jpg?1729659940',
        },
    }),
    new Chain({
        id: ChainId.SOLANA_MAINNET,
        name: 'Solana',
        disabled: false,
        explorer: 'https://explorer.solana.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/5426.png',
        },
    }),
    new Chain({
        id: ChainId.GOAT_MAINNET,
        name: 'Goat',
        disabled: false,
        explorer: 'https://explorer.goat.network',
        icons: {
            small: 'https://cdn.prod.website-files.com/6669a2e2b7f624149423b9be/6669b090137434ab4c6d11a2_favicoin%20goat.png',
            large: 'https://cdn.prod.website-files.com/6669a2e2b7f624149423b9be/6669b090137434ab4c6d11a2_favicoin%20goat.png',
        },
    }),
    new Chain({
        id: ChainId.SONIC_MAINNET,
        name: 'Sonic',
        disabled: false,
        explorer: 'https://sonicscan.org',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32684.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32684.png',
        },
    }),
    new Chain({
        id: ChainId.ABSTRACT_MAINNET,
        name: 'Abstract',
        disabled: false,
        explorer: 'https://abscan.org',
        icons: {
            small: 'https://s3.coinmarketcap.com/dexer/token/d51628b923d63af38ff8900885c6399b.jpg',
            large: 'https://s3.coinmarketcap.com/dexer/token/d51628b923d63af38ff8900885c6399b.jpg',
        },
    }),
    new Chain({
        id: ChainId.GNOSIS_MAINNET,
        name: 'Gnosis',
        disabled: false,
        explorer: 'https://gnosisscan.io',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1659.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1659.png',
        },
    }),
    new Chain({
        id: ChainId.BERACHAIN_MAINNET,
        name: 'Berachain',
        disabled: false,
        explorer: 'https://berascan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24647.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/24647.png',
        },
    }),
    new Chain({
        id: ChainId.UNICHAIN_MAINNET,
        name: 'Unichain',
        disabled: false,
        explorer: 'https://uniscan.xyz',
        icons: {
            small: 'https://coin-images.coingecko.com/asset_platforms/images/22206/thumb/unichain.png?1739323630',
            large: 'https://coin-images.coingecko.com/asset_platforms/images/22206/thumb/unichain.png?1739323630',
        },
    }),
    new Chain({
        id: ChainId.SONEIUM_MAINNET,
        name: 'Soneium',
        disabled: false,
        explorer: 'https://soneium.blockscout.com/',
        icons: {
            small: 'https://coin-images.coingecko.com/asset_platforms/images/22200/thumb/soneium-removebg-preview.png?1737099934',
            large: 'https://coin-images.coingecko.com/asset_platforms/images/22200/thumb/soneium-removebg-preview.png?1737099934',
        },
    }),
    new Chain({
        id: ChainId.OPBNB_MAINNET,
        name: 'opBNB',
        disabled: false,
        explorer: 'https://opbnb.bscscan.com',
        icons: {
            small: 'https://icons.llamao.fi/icons/chains/rsz_opbnb?w=48&h=48',
            large: 'https://icons.llamao.fi/icons/chains/rsz_opbnb?w=48&h=48',
        },
    }),
    new Chain({
        id: ChainId.HYPERLIQUID_MAINNET,
        name: 'HyperEVM',
        disabled: false,
        explorer: 'https://www.hyperscan.com',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32196.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/32196.png',
        },
    }),
    new Chain({
        id: ChainId.KATANA_MAINNET,
        name: 'Katana',
        disabled: false,
        explorer: 'https://explorer.katanarpc.com',
        icons: {
            small: 'https://katana.network/meta/favicon.ico',
            large: 'https://katana.network/meta/favicon.ico',
        },
    }),
    new Chain({
        id: ChainId.APECHAIN_MAINNET,
        name: 'ApeChain',
        disabled: false,
        explorer: 'https://apescan.io',
        icons: {
            small: 'https://coin-images.coingecko.com/asset_platforms/images/22184/small/apechain.jpg?1729564324',
            large: 'https://coin-images.coingecko.com/asset_platforms/images/22184/small/apechain.jpg?1729564324',
        },
    }),
    new Chain({
        id: ChainId.PLASMA_MAINNET,
        name: 'Plasma',
        disabled: false,
        explorer: 'https://plasmascan.to',
        icons: {
            small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png',
            large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/36645.png',
        },
    }),
]

export const getChainById = (chainId: ChainId | undefined): Chain | undefined => {
    if (!chainId) return undefined
    return chains.find((chain) => chain.id === chainId)
}

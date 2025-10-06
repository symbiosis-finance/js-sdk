import { ChainId } from '../../constants'
import { Config } from '../types'

export const config: Config = {
    advisor: {
        url: 'https://api.testnet.symbiosis.finance/calculations',
    },
    limits: [],
    omniPools: [
        // {
        //     chainId: ChainId.BSC_TESTNET,
        //     address: '0xFC385a59b2728cA437057E3cDBA4a2611B75c406', // BTC octopool
        //     oracle: '0xfdF3dBF16a7Dc8078FE4E9D0c1ac391dfb8B19aF',
        //     generalPurpose: true,
        // },
        // {
        //     chainId: ChainId.BSC_TESTNET,
        //     address: '0x3E524E5dbcEc08C3712D7Ac877Ad83cb8dAfCe8D', // BTC mainnet octopool
        //     oracle: '0x7a62416f10cd039cb538953953f94316FE1c32FA',
        //     generalPurpose: true,
        // },
        // {
        //     chainId: ChainId.BSC_TESTNET,
        //     address: '0x2826c540065C8eD792d7100ca89628E986f2F42E', // TON octopool
        //     oracle: '0xaF123f922b9cAe0F525c2E5A95314D7E8E229413',
        //     generalPurpose: true, // maybe in prod false, eth -\-> ton
        // },
    ],
    revertableAddress: {
        [ChainId.TRON_TESTNET]: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
        default: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    },
    refundAddress: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    chains: [
        // {
        //     // NOTE host chain is better to be first in the config
        //     id: ChainId.BSC_TESTNET,
        //     rpc: 'https://bsc-testnet-rpc.publicnode.com',
        //     filterBlockOffset: 2000,
        //     stables: [
        //         {
        //             name: 'WTON(BSC)',
        //             symbol: 'WTON(BSC)',
        //             address: '0xe015581A4e36eEbf170a3F4a686fa7606d511b13',
        //             chainId: ChainId.BSC_TESTNET,
        //             decimals: 9,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0xCc9f8896896c6eF44f2504A6A29e6057aDBfF179',
        //     metaRouterGateway: '0xaa067db6103E4b792bbE09540B5a7757F79d582a',
        //     bridge: '0xB299eee0Ed46b7a34C01F2a01fc83a0B45aA88AF',
        //     synthesis: '0x08f5c28ff0622FeF758c2C3c2a5EAEeb63D60D4c',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x9B8D0e0765cDa999910ff31A2204080E1192EfC7',
        //     multicallRouter: '0x086D8d30822086941729DF294f0e52E42EdC17F9',
        // },
        // {
        //     id: ChainId.SEPOLIA_TESTNET,
        //     rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
        //     filterBlockOffset: 2000,
        //     stables: [
        //         {
        //             name: 'TONCOIN',
        //             symbol: 'TONCOIN',
        //             address: '0x331f40cc27aC106e1d5242CE633dc6436626a6F8',
        //             chainId: ChainId.SEPOLIA_TESTNET,
        //             decimals: 9,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0x0000000000000000000000000000000000000000',
        //     metaRouterGateway: '0x0000000000000000000000000000000000000000',
        //     bridge: '0x0000000000000000000000000000000000000000',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x0000000000000000000000000000000000000000',
        // },
        // {
        //     id: ChainId.TON_TESTNET,
        //     rpc: '',
        //     filterBlockOffset: 0,
        //     stables: [
        //         {
        //             name: 'TON Coin',
        //             symbol: 'TON',
        //             address: '0x7eA393298D1077e19ec59F8e3FE8fe642738c08C', // derived from EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4
        //             chainId: ChainId.TON_TESTNET,
        //             isNative: false,
        //             decimals: 9,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //             },
        //         },
        //         {
        //             name: 'USDt',
        //             symbol: 'USDT',
        //             address: '0x46deec715e419a1f0f5959b5c8450894959d2dbf', // derived from EQD73uqQJHKAg140YSlG3uxxXkGaHw9ZWbXIRQiUlZ0tv79a
        //             chainId: ChainId.TON_TESTNET,
        //             isNative: false,
        //             decimals: 9,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0x0000000000000000000000000000000000000000',
        //     metaRouterGateway: '0x0000000000000000000000000000000000000000',
        //     bridge: '0x0000000000000000000000000000000000000000',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x0000000000000000000000000000000000000000',
        //     tonPortal: 'kQChdry7W2UrILq1Wm1SN3WASMR8eWOAHQaDugEgOMVAcbXX',
        // },
        // {
        //     id: ChainId.BTC_MUTINY,
        //     rpc: 'https://mutinynet.com/api',
        //     filterBlockOffset: 2000,
        //     stables: [
        //         {
        //             name: 'Bitcoin',
        //             symbol: 'BTC',
        //             address: '0xEa46baF0c59d7A22E14F7ae30cb51086FFDe55C3', // is the btc portal genesis tx
        //             chainId: ChainId.BTC_MUTINY,
        //             decimals: 8,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0x0000000000000000000000000000000000000000',
        //     metaRouterGateway: '0x0000000000000000000000000000000000000000',
        //     bridge: '0x0000000000000000000000000000000000000000',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x0000000000000000000000000000000000000000',
        //     symBtc: {
        //         address: '0xEa3f6885Ef517EcaBB2888b0ef9c6873c97f24d4',
        //         chainId: ChainId.SEPOLIA_TESTNET,
        //     },
        //     forwarderUrl: 'https://relayers.testnet.symbiosis.finance/mutinynet/forwarder/api/v1',
        // },
        // {
        //     id: ChainId.BTC_TESTNET4,
        //     rpc: 'https://mempool.space/testnet4/api',
        //     filterBlockOffset: 2000,
        //     stables: [
        //         {
        //             name: 'Bitcoin',
        //             symbol: 'BTC',
        //             address: '0xAdBdcB71a1BD1911C18B583705CB096d3A3cE9a5', // is the btc portal genesis tx
        //             chainId: ChainId.BTC_TESTNET4,
        //             decimals: 8,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0x0000000000000000000000000000000000000000',
        //     metaRouterGateway: '0x0000000000000000000000000000000000000000',
        //     bridge: '0x0000000000000000000000000000000000000000',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x0000000000000000000000000000000000000000',
        //     symBtc: {
        //         address: '0x2ff5940024af75e15b810d64ae2c89f632e7f45f',
        //         chainId: ChainId.SEPOLIA_TESTNET,
        //     },
        //     forwarderUrl: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
        // },
        // {
        //     id: ChainId.BTC_MAINNET,
        //     rpc: 'https://mempool.space/api',
        //     filterBlockOffset: 2000,
        //     stables: [
        //         {
        //             name: 'Bitcoin',
        //             symbol: 'BTC',
        //             address: '0x5a01380F0236A9cf36C07F3aeb6faA81bF506BD2', // is the btc portal genesis tx
        //             chainId: ChainId.BTC_MAINNET,
        //             decimals: 8,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 0,
        //     metaRouter: '0x0000000000000000000000000000000000000000',
        //     metaRouterGateway: '0x0000000000000000000000000000000000000000',
        //     bridge: '0x0000000000000000000000000000000000000000',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x0000000000000000000000000000000000000000',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x0000000000000000000000000000000000000000',
        //     symBtc: {
        //         address: '0x12708f73252953A90840d76F064C7b9fCF2EE0CA',
        //         chainId: ChainId.SEPOLIA_TESTNET,
        //     },
        //     forwarderUrl: 'https://relayers.testnet.symbiosis.finance/mainnet/forwarder/api/v1',
        // },
        {
            id: ChainId.SEPOLIA_TESTNET,
            rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
            spareRpcs: [],
            filterBlockOffset: 1000,
            stables: [
                // {
                //     name: 'mutSymBtc',
                //     address: '0x41540e95B10383408cfE201974c88E6C3ef9323A',
                //     symbol: 'mutSymBtc',
                //     decimals: 8,
                //     chainId: 11155111,
                //     icons: {
                //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //     },
                // },
                // {
                //     name: 't4SymBtc',
                //     address: '0x04cd23122a21f6c5F912FC7B9aBC508302899Dfb',
                //     symbol: 't4SymBtc',
                //     decimals: 8,
                //     chainId: 11155111,
                //     icons: {
                //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //     },
                // },
                // {
                //     name: 'mSymBtc',
                //     address: '0xeD86914A9478a066d82b2bE3E5B99A38BAaE23ce',
                //     symbol: 'mSymBtc',
                //     decimals: 8,
                //     chainId: 11155111,
                //     icons: {
                //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                //     },
                // },
                {
                    name: 'WETH',
                    address: '0xb16f35c0ae2912430dac15764477e179d9b9ebea',
                    symbol: 'WETH',
                    decimals: 18,
                    chainId: 11155111,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/2396.png',
                    },
                },
            ],
            router: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
            dexFee: 30,
            metaRouter: '0x8b03ad402ab3f1477bdfa64647718e5c537c0029',
            metaRouterGateway: '0xc3b59B4a7961EF8FD24C9838731D1f598884F53d',
            bridge: '0x7dc13B605508F91Fcd3bf7803C2b96B43941B4E8',
            synthesis: '0x3e6235b91c6734821b4037E6459f861E465D4192',
            portal: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38',
            fabric: '0xb4ADe33Bba3512c8c0B489cbd03aAd3557EC49Ca',
            multicallRouter: '0xF3Cfa393be621097669BcD2bD4923CEC347E1210',
        },
        // {
        //     id: ChainId.AVAX_TESTNET,
        //     rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
        //     spareRpcs: [
        //         'https://avalanche-fuji-c-chain-rpc.publicnode.com',
        //         'https://ava-testnet.public.blastapi.io/ext/bc/C/rpc',
        //     ],
        //     filterBlockOffset: 2000,
        //     stables: [
        //         // {
        //         //     name: 'Wrapped BTC',
        //         //     address: '0x9374Ea7A11c5B185A6631effF22c015E71c67581',
        //         //     symbol: 'WBTC',
        //         //     decimals: 8,
        //         //     chainId: ChainId.AVAX_TESTNET,
        //         //     icons: {
        //         //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //         //         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //         //     },
        //         // },
        //         // {
        //         //     name: 'Wrapped BTC',
        //         //     address: '0xE34EBC0DE48F2947510cFf88a13F1c0B11FD1109',
        //         //     symbol: 'WBTC(Mainnet)',
        //         //     decimals: 8,
        //         //     chainId: ChainId.AVAX_TESTNET,
        //         //     icons: {
        //         //         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //         //         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        //         //     },
        //         // },
        //         {
        //             name: 'WTON',
        //             address: '0xCc9f8896896c6eF44f2504A6A29e6057aDBfF179',
        //             symbol: 'WTON(Mainnet)',
        //             decimals: 9,
        //             chainId: ChainId.AVAX_TESTNET,
        //             icons: {
        //                 large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //                 small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        //             },
        //         },
        //     ],
        //     router: '0x0000000000000000000000000000000000000000',
        //     dexFee: 30, // 0.03%
        //     metaRouter: '0x0EB4Bb54E1551Db887ADdDAbD2562da13fE57D14',
        //     metaRouterGateway: '0xbA2269b1E4b2eb62FdaA2c7D7bbaC052d4FD05cE',
        //     bridge: '0xcC0DB081360Eb259bdf6911976c51cAF1B72e845',
        //     synthesis: '0x0000000000000000000000000000000000000000',
        //     portal: '0x78Bb4D4872121f162BB3e938F0d10cf34E999648',
        //     fabric: '0x0000000000000000000000000000000000000000',
        //     multicallRouter: '0x8C9D3CE1D59d73259018dBC9859F6eBe62Bbf862',
        // },
    ],
}

import { ChainId } from '../../constants'
import { Config } from '../types'

export const config: Config = {
    advisor: {
        url: 'https://api.testnet.symbiosis.finance/calculations',
    },
    omniPools: [
        {
            chainId: 97,
            address: '0x569D2a232F5f2a462673fAf184ED9640e8A9F4D8',
            oracle: '0xcE29b84160fe8B6Fc1c6E5aD66F1F43279F2F1C9',
        },
        {
            chainId: 97,
            address: '0xc44AF80948B8a20bb781277559457ce0F2893b8b',
            oracle: '0x69cE6CA199c5Ca995C954c15F925D68ee0810153',
        },
    ],
    revertableAddress: {
        [ChainId.TRON_TESTNET]: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
        default: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    },
    chains: [
        {
            id: 97,
            rpc: 'https://rpc.ankr.com/bsc_testnet_chapel',
            filterBlockOffset: 2000,
            waitForBlocksCount: 20,
            stables: [
                {
                    name: 'Binance USD',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    symbol: 'BUSD',
                    decimals: 18,
                    chainId: 97,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4687.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4687.png',
                    },
                },
            ],
            router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
            dexFee: 30,
            metaRouter: '0xCc9f8896896c6eF44f2504A6A29e6057aDBfF179',
            metaRouterGateway: '0xaa067db6103E4b792bbE09540B5a7757F79d582a',
            bridge: '0xB299eee0Ed46b7a34C01F2a01fc83a0B45aA88AF',
            synthesis: '0x08f5c28ff0622FeF758c2C3c2a5EAEeb63D60D4c',
            portal: '0x0000000000000000000000000000000000000000',
            fabric: '0x9B8D0e0765cDa999910ff31A2204080E1192EfC7',
            multicallRouter: '0x086D8d30822086941729DF294f0e52E42EdC17F9',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
        },
        {
            id: 43113,
            rpc: 'https://rpc.ankr.com/avalanche_fuji',
            filterBlockOffset: 2000,
            waitForBlocksCount: 20,
            stables: [
                {
                    name: 'USDT',
                    symbol: 'USDT',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    chainId: 43113,
                    decimals: 6,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                    },
                },
            ],
            router: '0x4F86a87985a2eD1E843c0b93755Ac06A3DbCc55E',
            dexFee: 30,
            metaRouter: '0x0EB4Bb54E1551Db887ADdDAbD2562da13fE57D14',
            metaRouterGateway: '0xbA2269b1E4b2eb62FdaA2c7D7bbaC052d4FD05cE',
            bridge: '0xcC0DB081360Eb259bdf6911976c51cAF1B72e845',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0x78Bb4D4872121f162BB3e938F0d10cf34E999648',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x8C9D3CE1D59d73259018dBC9859F6eBe62Bbf862',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
        },
        {
            id: 80001,
            rpc: 'https://rpc.ankr.com/polygon_mumbai',
            filterBlockOffset: 2000,
            waitForBlocksCount: 60,
            stables: [
                {
                    name: 'USDT',
                    symbol: 'USDT',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    chainId: 80001,
                    decimals: 6,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                    },
                },
            ],
            router: '0xca33f6D096BDD7FcB28d708f631cD76E73Ecfc2d',
            dexFee: 30,
            metaRouter: '0xa76276D2af4D36EdfB267Bf7C309194fAD16b727',
            metaRouterGateway: '0x720e9912Bb845Df78dc9e8101dAC23e1cf694b1D',
            bridge: '0x2578412aECCcc32f270A03cfBa25f6557aF4017b',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0x9ad7e9A0D18cC56303277dC5bF77D1910570509a',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0xEc36ED7f5Be3006CF04F85d4851DbDB85b60C19E',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
        },
        {
            id: 11155111,
            rpc: 'https://rpc.sepolia.org',
            filterBlockOffset: 2000,
            waitForBlocksCount: 20,
            stables: [
                {
                    name: 'Wrapped ETH',
                    address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
                    symbol: 'WETH',
                    decimals: 18,
                    chainId: 11155111,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
                    },
                },
            ],
            router: '0xDe886ff69fE234c8db2e2694788e73aa6be8d0c7',
            dexFee: 30,
            metaRouter: '0xab5694083Ae2c94023fBcdBf00e6f6e9715CC2Bc',
            metaRouterGateway: '0xAC176B92F6AbC9c286F0742853ABF430AAb053b3',
            bridge: '0x7dc13B605508F91Fcd3bf7803C2b96B43941B4E8',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0xF3Cfa393be621097669BcD2bD4923CEC347E1210',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 2336000,
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 534351,
            rpc: 'https://sepolia-rpc.scroll.io',
            filterBlockOffset: 2000,
            waitForBlocksCount: 1,
            stables: [
                {
                    name: 'Wrapped ETH',
                    address: '0x5300000000000000000000000000000000000004',
                    symbol: 'WETH',
                    decimals: 18,
                    chainId: 534351,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
                    },
                },
            ],
            router: '0x0000000000000000000000000000000000000000',
            dexFee: 30,
            metaRouter: '0x7024030C21aae0E8E9CE9d8C6f23ad024A7D1627',
            metaRouterGateway: '0x19Ea94A38dE3eBa5F2BFA4bB5d241c41915bf5ab',
            bridge: '0x6fa0a77Bb9FC5AC9e9D9C26c101067486291d2B5',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0x7739E567B9626ca241bdC5528343F92F7e59Af37',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x9D15297f42fEf485f2d061a012cfE699Cc49132B',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 2336000,
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 59140,
            rpc: 'https://rpc.goerli.linea.build',
            filterBlockOffset: 2000,
            waitForBlocksCount: 5,
            stables: [
                {
                    name: 'Tether',
                    symbol: 'USDT',
                    address: '0xAED47A51AeFa6f95A388aDA3c459d94FF46fC4BB',
                    chainId: 59140,
                    decimals: 6,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                    },
                },
            ],
            dexFee: 30,
            router: '0x106c6743C1f8ED9c5c824887AadAc8215294f8b6',
            metaRouter: '0x46557FA4678b334e03A2cFf526d38afe9BA2e4A0',
            metaRouterGateway: '0x32D3988C6396b3553EC0025b27A35780C0CF304F',
            bridge: '0x9D15297f42fEf485f2d061a012cfE699Cc49132B',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0xc098feAc51a186d3E0B446146007e1d87E34D6f2',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x7dc13B605508F91Fcd3bf7803C2b96B43941B4E8',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
        },
        {
            id: 5001,
            rpc: 'https://rpc.testnet.mantle.xyz',
            filterBlockOffset: 2000,
            waitForBlocksCount: 5,
            stables: [
                {
                    name: 'Tether',
                    symbol: 'USDT',
                    address: '0xAED47A51AeFa6f95A388aDA3c459d94FF46fC4BB',
                    chainId: 5001,
                    decimals: 6,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                    },
                },
            ],
            dexFee: 30,
            router: '0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033',
            metaRouter: '0x15e06C6009382f3A563B05a8E377d34d3B6ccf8B',
            metaRouterGateway: '0x13Bd0484B29916970e16A0BA1db6eBA6C0d90d79',
            bridge: '0x9D15297f42fEf485f2d061a012cfE699Cc49132B',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0xc098feAc51a186d3E0B446146007e1d87E34D6f2',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x7dc13B605508F91Fcd3bf7803C2b96B43941B4E8',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 2336000,
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 2494104990,
            rpc: 'https://api.shasta.trongrid.io',
            filterBlockOffset: 3000,
            waitForBlocksCount: 19,
            stables: [
                {
                    name: 'USDT',
                    symbol: 'USDT',
                    address: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
                    chainId: 2494104990,
                    decimals: 6,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
                    },
                },
            ],
            router: '0x623209682018f557a5255390f3158cf5fc8a855c',
            dexFee: 25,
            metaRouter: '0x3d8ea18ce50759cf9a41f580d47b54e2bf608b45',
            metaRouterGateway: '0xb7b2a08e6b49d5a0c05f93d715f84518f8c06f8a',
            bridge: '0x4002f99b8452218320e5b0dbb7aea31b8d51028c',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0xa598d68e8199e147552915fef169108158a99971',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x0000000000000000000000000000000000000000',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.OKX_X1_TESTNET,
            rpc: 'https://testrpc.x1.tech',
            filterBlockOffset: 3000,
            waitForBlocksCount: 0,
            stables: [
                {
                    name: 'WETH',
                    symbol: 'WETH',
                    address: '0xbec7859bc3d0603bec454f7194173e36bf2aa5c8',
                    chainId: ChainId.OKX_X1_TESTNET,
                    decimals: 18,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
                    },
                },
            ],
            router: '0x0000000000000000000000000000000000000000',
            dexFee: 0,
            metaRouter: '0xE52e3c838CC91C60a701E78B5043ba9eeEeb55db',
            metaRouterGateway: '0x13fF611B06bEb2A29a49cc3c825cD0eE74967bE3',
            bridge: '0x9D15297f42fEf485f2d061a012cfE699Cc49132B',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0x41151CEfFB743650E14425c7749019E491Fd1987',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x7739E567B9626ca241bdC5528343F92F7e59Af37',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 0,
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
        },
    ],
}

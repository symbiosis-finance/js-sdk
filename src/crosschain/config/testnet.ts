import { Config } from '../types'

export const config: Config = {
    minSwapAmountInUsd: 10,
    maxSwapAmountInUsd: 10000,
    advisor: {
        url: 'https://api.testnet.symbiosis.finance/calculations',
    },
    chains: [
        {
            id: 4,
            rpc: 'https://rpc.ankr.com/eth_rinkeby',
            filterBlockOffset: 3000,
            waitForBlocksCount: 5,
            stables: [
                {
                    name: 'USD Coin',
                    address: '0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b',
                    symbol: 'USDC',
                    isStable: true,
                    decimals: 6,
                    chainId: 4,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                    },
                },
            ],
            nerves: [],
            router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
            dexFee: 30,
            metaRouter: '0x57751D871E199f6fB204d0FEb9B7055B639906a8',
            metaRouterGateway: '0x1c136C8fA324708b0621008777446eb509527e9A',
            bridge: '0x38b07a83b691bB221d0710B0eA6Ebd7494E106D3',
            synthesis: '0xBA7c80bb5d316c4eE55F96F47d1a1477fFD1aFb6',
            portal: '0x68801662cab0D678E5216CB67DaD350271375024',
            fabric: '0xB5ec93b32320Adb12Eef81cB97B68a3C69f8bc4E',
            multicallRouter: '0x4D497d76bB2D1696478BDe75cFe41635d4e3489B',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            autoFarm: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 97,
            rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
            filterBlockOffset: 3000,
            waitForBlocksCount: 20,
            stables: [
                {
                    name: 'Binance USD',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    symbol: 'BUSD',
                    decimals: 18,
                    chainId: 97,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                    },
                },
                {
                    name: 'Synthetic USD Coin',
                    address: '0x6fECa3dB72eE8a2CF9653136E98565993b541848',
                    symbol: 'sUSDC',
                    decimals: 6,
                    chainId: 97,
                    chainFromId: 4,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                    },
                },
            ],
            nerves: [
                {
                    address: '0x83E28bdF57a381Ec600f2fA0Cf423019EE9A4649',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0x6fECa3dB72eE8a2CF9653136E98565993b541848',
                    ],
                    decimals: [18, 6],
                },
            ],
            router: '0xD99D1c33F9fC3444f8101754aBC46c52416550D1',
            dexFee: 25,
            metaRouter: '0x77Bd1d0F771bc5034AB6aC743D7d7b9c220b0D07',
            metaRouterGateway: '0x98A5B2040cAf5bAA073B04d1a7Fb2907A8881B3B',
            bridge: '0x67e2696fb65641902AA26DC9bABf76cE134CA377',
            synthesis: '0xF0f4F93CE9A0Ee6e9ad9406e0fea81843164fD74',
            portal: '0x1EE47a7DF64a8A23FA47458d9d7b148559b728ac',
            fabric: '0xdBfb647247E4e402437f717FB154a990a6f5372d',
            multicallRouter: '0x11F86290B2E223Ff66B89d9BED8004815436ee77',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            autoFarm: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 43113,
            rpc: 'https://rpc.ankr.com/avalanche_fuji',
            filterBlockOffset: 3000,
            waitForBlocksCount: 20,
            stables: [
                {
                    name: 'USDT',
                    symbol: 'USDT',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    chainId: 43113,
                    decimals: 6,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
                    },
                },
                {
                    name: 'Synthetic USDC',
                    symbol: 'sUSDC',
                    address: '0xF18a3A0516d6e7A5A0416c79499E1dE370EBe1E2',
                    chainId: 43113,
                    chainFromId: 4,
                    decimals: 6,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                    },
                },
                {
                    name: 'Synthetic BUSD',
                    symbol: 'sBUSD',
                    address: '0x80423D3640674a4c2EFFC7a628C1f22d71C3C994',
                    chainId: 43113,
                    chainFromId: 97,
                    decimals: 18,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                    },
                },
                {
                    name: 'Synthetic USDT',
                    symbol: 'sUSDT',
                    address: '0x7857192Cc69869CaE1701127338Fd9b033f88915',
                    chainId: 43113,
                    chainFromId: 80001,
                    decimals: 6,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                    },
                },
            ],
            nerves: [
                {
                    address: '0x38b07a83b691bB221d0710B0eA6Ebd7494E106D3',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0xF18a3A0516d6e7A5A0416c79499E1dE370EBe1E2',
                    ],
                    decimals: [6, 6],
                },
                {
                    address: '0x68801662cab0D678E5216CB67DaD350271375024',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0x80423D3640674a4c2EFFC7a628C1f22d71C3C994',
                    ],
                    decimals: [6, 18],
                },
                {
                    address: '0xB5ec93b32320Adb12Eef81cB97B68a3C69f8bc4E',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0x7857192Cc69869CaE1701127338Fd9b033f88915',
                    ],
                    decimals: [6, 6],
                },
            ],
            router: '0x4F86a87985a2eD1E843c0b93755Ac06A3DbCc55E',
            dexFee: 30,
            metaRouter: '0xAc7e49bd1Ed1859a8928318603260bFF91c4d6a4',
            metaRouterGateway: '0x9af39c876D55C7eBC63C1852Cdf4aacf839467a4',
            bridge: '0x68d12DD9cd42BD62A6F707A96B3dc8D1A6a9f076',
            synthesis: '0x9A857D526A9e53697a9Df5fFc40bCCD70E7A0388',
            portal: '0x14be03e34B05a87A028acfF0292C1AF135D26699',
            fabric: '0x69fA0Ae9E3065B9d6c4c1909E101807bAaf3227e',
            multicallRouter: '0x20c6f13c168bA6C90b0AD0cC0C021d01D1DFA820',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            autoFarm: '0x0000000000000000000000000000000000000000',
        },
        {
            id: 80001,
            rpc: 'https://rpc.ankr.com/polygon_mumbai',
            filterBlockOffset: 3000,
            waitForBlocksCount: 60,
            stables: [
                {
                    name: 'USDT',
                    symbol: 'USDT',
                    address: '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                    chainId: 80001,
                    decimals: 6,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xdAC17F958D2ee523a2206206994597C13D831ec7/logo.png',
                    },
                },
                {
                    name: 'Synthetic BUSD',
                    symbol: 'sBUSD',
                    address: '0x680889574BAFC0B13d0F4B593C0f521F0511edA3',
                    chainId: 80001,
                    chainFromId: 97,
                    decimals: 18,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BUSD-BD1/logo.png',
                    },
                },
                {
                    name: 'Synthetic USDC',
                    symbol: 'sUSDC',
                    address: '0xA6ec42a332039C9BDA7779A27b867db46fbdDE60',
                    chainId: 80001,
                    chainFromId: 4,
                    decimals: 6,
                    isStable: true,
                    icons: {
                        large: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                        small: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png',
                    },
                },
            ],
            nerves: [
                {
                    address: '0x9666642b7B68281F912A0b4bee1d00b15ce7B28a',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0xA6ec42a332039C9BDA7779A27b867db46fbdDE60',
                    ],
                    decimals: [6, 6],
                },
                {
                    address: '0x575Fc14176F6F1fdbFC02b1FBe498b247A608203',
                    tokens: [
                        '0x9a01bf917477dd9f5d715d188618fc8b7350cd22',
                        '0x680889574BAFC0B13d0F4B593C0f521F0511edA3',
                    ],
                    decimals: [6, 18],
                },
            ],
            router: '0xca33f6D096BDD7FcB28d708f631cD76E73Ecfc2d',
            dexFee: 30,
            metaRouter: '0x21A03993657116c281aa92206f2c0e6760707A26',
            metaRouterGateway: '0x27364922A07a39e4898a514751e28343131784b3',
            bridge: '0xEdCAeb1D346396B3e4E861e4A6F0B72b9850fCC5',
            synthesis: '0xEE0F117Db9ED4d1A4421cdCa7d32a1F878eF4F7C',
            portal: '0xfF0a032e793bAf78C4153CD96135013D6A468b39',
            fabric: '0xe0A0CEb6f3e740C4fc4A1eb38e4135440470175A',
            multicallRouter: '0xd44a28f1d6Cc17389597e415FAd6c6338dA0F0dC',
            aavePool: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
            autoFarm: '0x0000000000000000000000000000000000000000',
        },
    ],
}

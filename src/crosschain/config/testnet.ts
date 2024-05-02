import { ChainId } from '../../constants'
import { Config } from '../types'

export const config: Config = {
    advisor: {
        url: 'https://api.testnet.symbiosis.finance/calculations',
    },
    omniPools: [
        {
            chainId: ChainId.SEPOLIA_TESTNET,
            address: '0x9A857D526A9e53697a9Df5fFc40bCCD70E7A0388', // Btc octopul
            oracle: '0x14be03e34B05a87A028acfF0292C1AF135D26699',
            generalPurpose: true,
        },
    ],
    revertableAddress: {
        [ChainId.TRON_TESTNET]: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
        default: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    },
    chains: [
        {
            id: ChainId.AVAX_TESTNET,
            rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
            spareRpcs: [
                'https://avalanche-fuji-c-chain-rpc.publicnode.com',
                'https://ava-testnet.public.blastapi.io/ext/bc/C/rpcZ',
            ],
            filterBlockOffset: 2000,
            stables: [
                {
                    name: 'Wrapped BTC',
                    address: '0x9374Ea7A11c5B185A6631effF22c015E71c67581', // address erc-20 btc
                    symbol: 'WBTC',
                    decimals: 8,
                    chainId: ChainId.AVAX_TESTNET,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                    },
                },
            ],
            router: '0x0000000000000000000000000000000000000000', // DEX Univ2, legacy
            dexFee: 30, // 0.03%
            metaRouter: '0x0EB4Bb54E1551Db887ADdDAbD2562da13fE57D14', // Orchestrate between synth contracts and doing swaps ???
            metaRouterGateway: '0xbA2269b1E4b2eb62FdaA2c7D7bbaC052d4FD05cE', // Entrypoint contract, for approve purpose only
            bridge: '0xcC0DB081360Eb259bdf6911976c51cAF1B72e845', //  generate oracle request for relayers , proxy to portal and synthetus
            synthesis: '0x0000000000000000000000000000000000000000', // [IMPORTANT]: Burn/Mint Synth function
            symBtc: '0x0000000000000000000000000000000000000000', // [!!OLD!!!! contract change] new is 0xc7F1A6768B16De4BB15c146fd5030cD9F50533ab special contract for btc operation connected with synthesis
            portal: '0x78Bb4D4872121f162BB3e938F0d10cf34E999648', // Release/lock base tokens
            fabric: '0x0000000000000000000000000000000000000000', // [IMPORTANT]: Contract that stores token representations and create them as fabric method
            multicallRouter: '0x8C9D3CE1D59d73259018dBC9859F6eBe62Bbf862', // multiple operations
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 2336000,
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.SEPOLIA_TESTNET,
            rpc: 'https://sepolia.gateway.tenderly.co',
            spareRpcs: ['https://sepolia.drpc.org', 'https://rpc-sepolia.rockx.com'],
            filterBlockOffset: 2000,
            stables: [
                {
                    name: 'Wrapped ETH',
                    address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
                    symbol: 'WETH',
                    decimals: 18,
                    chainId: ChainId.SEPOLIA_TESTNET,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
                    },
                },
                {
                    name: 'Wrapped BTC',
                    address: '0xD0684a311F47AD7fdFf03951d7b91996Be9326E1',
                    symbol: 'WBTC',
                    decimals: 8,
                    chainId: ChainId.SEPOLIA_TESTNET,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                    },
                },
            ],
            router: '0xDe886ff69fE234c8db2e2694788e73aa6be8d0c7', // DEX Univ2, legacy
            dexFee: 30, // 0.03%
            metaRouter: '0xe19f85478Ee6C4D67d14386F646Dd1E9C4461A9b', // Orchestrate between synth contracts and doing swaps ???
            metaRouterGateway: '0xfB589f8B73a32D2e7867b8529408f6f8306887B6', // Entrypoint contract, for approve purpose only
            bridge: '0x042cF6a0690C9B8607c5B19Cb18807F1D66c9339', //  generate oracle request for relayers , proxy to portal and synthetus
            synthesis: '0x3e6235b91c6734821b4037E6459f861E465D4192', // [IMPORTANT]: Burn/Mint Synth function
            symBtc: '0x7057aB3fB2BeE9c18e0cDe4240DE4ff7f159E365', // [!!OLD!!!! contract change] new is 0xc7F1A6768B16De4BB15c146fd5030cD9F50533ab special contract for btc operation connected with synthesis
            portal: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38', // Release/lock base tokens  !!!????? Don't know real address for this contracts
            fabric: '0xb4ADe33Bba3512c8c0B489cbd03aAd3557EC49Ca', // [IMPORTANT]: Contract that stores token representations and create them as fabric method
            multicallRouter: '0xF3Cfa393be621097669BcD2bD4923CEC347E1210', // multiple operations
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 2336000,
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.BTC_TESTNET,
            isBtcChain: true,
            rpc: '',
            filterBlockOffset: 2000, // ??
            stables: [
                {
                    name: 'Bitcoin',
                    symbol: 'BTC',
                    address: '0x3412197A707413310520010CD5adCCFA657e9dee', // [IMPORTANT]: This is mock address from symbtc contract
                    chainId: ChainId.BTC_TESTNET, // [IMPORTANT]: This is chain id from symbtc contract
                    decimals: 8,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                    },
                },
            ],
            router: '0x0000000000000000000000000000000000000000',
            dexFee: 0,
            metaRouter: '0x0000000000000000000000000000000000000000',
            metaRouterGateway: '0x0000000000000000000000000000000000000000',
            bridge: '0x0000000000000000000000000000000000000000',
            synthesis: '0x0000000000000000000000000000000000000000',
            portal: '0x0000000000000000000000000000000000000000',
            fabric: '0x0000000000000000000000000000000000000000',
            multicallRouter: '0x0000000000000000000000000000000000000000',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            blocksPerYear: 52650, // from 140 avg block per day
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
    ],
}

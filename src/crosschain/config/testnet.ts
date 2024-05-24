import { ChainId } from '../../constants'
import { Config } from '../types'

export const config: Config = {
    btc: {
        forwarderUrl: 'https://relayers.testnet.symbiosis.finance/forwarder/api/v1',
    },
    advisor: {
        url: 'https://api.testnet.symbiosis.finance/calculations',
    },
    omniPools: [
        {
            chainId: ChainId.BSC_TESTNET,
            address: '0xFC385a59b2728cA437057E3cDBA4a2611B75c406', // BTC octopool
            oracle: '0xfdF3dBF16a7Dc8078FE4E9D0c1ac391dfb8B19aF',
            generalPurpose: true,
        },
    ],
    revertableAddress: {
        [ChainId.TRON_TESTNET]: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
        default: '0x1b5D6DDF6086Bb06616f58274F894099c31e9DB5',
    },
    chains: [
        {
            id: ChainId.BSC_TESTNET,
            rpc: 'https://rpc.ankr.com/bsc_testnet_chapel',
            filterBlockOffset: 2000,
            stables: [],
            router: '0x0000000000000000000000000000000000000000',
            dexFee: 0,
            metaRouter: '0xCc9f8896896c6eF44f2504A6A29e6057aDBfF179',
            metaRouterGateway: '0xaa067db6103E4b792bbE09540B5a7757F79d582a',
            bridge: '0xB299eee0Ed46b7a34C01F2a01fc83a0B45aA88AF',
            synthesis: '0x08f5c28ff0622FeF758c2C3c2a5EAEeb63D60D4c',
            portal: '0x0000000000000000000000000000000000000000',
            fabric: '0x9B8D0e0765cDa999910ff31A2204080E1192EfC7',
            multicallRouter: '0x086D8d30822086941729DF294f0e52E42EdC17F9',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.AVAX_TESTNET,
            rpc: 'https://api.avax-test.network/ext/bc/C/rpc',
            spareRpcs: [
                'https://avalanche-fuji-c-chain-rpc.publicnode.com',
                'https://ava-testnet.public.blastapi.io/ext/bc/C/rpc',
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
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.SEPOLIA_TESTNET,
            rpc: 'https://sepolia.gateway.tenderly.co',
            spareRpcs: ['https://sepolia.drpc.org', 'https://rpc-sepolia.rockx.com'],
            filterBlockOffset: 2000,
            stables: [
                {
                    name: 'Synthetic BTC',
                    address: '0x4d0EF82dfE2896eE3222bE5a9e9188ae1DCcd05F',
                    symbol: 'sBTC',
                    decimals: 8,
                    chainId: 11155111,
                    icons: {
                        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
                    },
                },
            ],
            router: '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008',
            dexFee: 30,
            metaRouter: '0x8b03ad402ab3f1477bdfa64647718e5c537c0029',
            metaRouterGateway: '0xc3b59B4a7961EF8FD24C9838731D1f598884F53d',
            bridge: '0x7dc13B605508F91Fcd3bf7803C2b96B43941B4E8',
            synthesis: '0x3e6235b91c6734821b4037E6459f861E465D4192',
            symBtc: '0x7057aB3fB2BeE9c18e0cDe4240DE4ff7f159E365', // [OLD!!!] new one is 0xc7F1A6768B16De4BB15c146fd5030cD9F50533ab
            portal: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38',
            fabric: '0xb4ADe33Bba3512c8c0B489cbd03aAd3557EC49Ca',
            multicallRouter: '0xF3Cfa393be621097669BcD2bD4923CEC347E1210',
            aavePool: '0x0000000000000000000000000000000000000000',
            aavePoolDataProvider: '0x0000000000000000000000000000000000000000',
            creamComptroller: '0x0000000000000000000000000000000000000000',
            creamCompoundLens: '0x0000000000000000000000000000000000000000',
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
        {
            id: ChainId.BTC_TESTNET,
            rpc: '',
            filterBlockOffset: 2000,
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
            renGatewayRegistry: '0x0000000000000000000000000000000000000000',
        },
    ],
}

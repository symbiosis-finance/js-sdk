import { describe, expect, test } from 'vitest'
import { Symbiosis } from '../../src/crosschain/symbiosis'
import { Token } from '../../src/entities'
import { ChainId } from '../../src/constants'
import { config as mainnet } from '../../src/crosschain/config/mainnet'

const symbiosis = new Symbiosis('mainnet', 'test')

describe('#getRepresentation', () => {
    test('by real', () => {
        const token = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDC',
            decimals: 6,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        })

        const reprBoba = symbiosis.getRepresentation(token, ChainId.BOBA_BNB)
        expect(reprBoba?.address).toBe('0x7d6EC42b5d9566931560411a8652Cea00b90d982')

        const reprTelos = symbiosis.getRepresentation(token, ChainId.TELOS_MAINNET)
        expect(reprTelos?.address).toBe('0xe6E5f3d264117E030C21920356641DbD5B3d660c')
    })

    test('by synth', () => {
        const token = new Token({
            chainId: ChainId.BOBA_BNB,
            symbol: 'USDC',
            chainFromId: ChainId.ETH_MAINNET,
            decimals: 6,
            address: '0x7d6EC42b5d9566931560411a8652Cea00b90d982',
        })

        const real = symbiosis.getRepresentation(token, ChainId.ETH_MAINNET)
        expect(real?.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    })

    test('by synth', () => {
        const token = new Token({
            chainId: ChainId.TELOS_MAINNET,
            symbol: 'USDC',
            decimals: 6,
            chainFromId: ChainId.ETH_MAINNET,
            address: '0xe6E5f3d264117E030C21920356641DbD5B3d660c',
        })

        const real = symbiosis.getRepresentation(token, ChainId.ETH_MAINNET)
        expect(real?.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
    })
})

describe('#getOmniPoolByToken', () => {
    test('by real', () => {
        const token = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDC',
            decimals: 6,
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        })

        const pool = symbiosis.getOmniPoolByToken(token)
        expect(pool?.id).toBe(0)
        expect(pool?.address).toBe('0x6148FD6C649866596C3d8a971fC313E5eCE84882')
        expect(pool?.chainId).toBe(ChainId.BOBA_BNB)
    })

    test(`by synth`, () => {
        const token = new Token({
            decimals: 6,
            symbol: 'sUSDC.e',
            name: 'Synthetic USD Coin from Avalanche',
            chainId: ChainId.BOBA_BNB,
            address: '0x6dF9C221F52537DFD63d70721EEAA0C4d4472C18',
            isNative: false,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
            chainFromId: ChainId.AVAX_MAINNET,
        })

        const pool = symbiosis.getOmniPoolByToken(token)
        expect(pool?.id).toBe(0)
        expect(pool?.address).toBe('0x6148FD6C649866596C3d8a971fC313E5eCE84882')
        expect(pool?.chainId).toBe(ChainId.BOBA_BNB)
    })

    test(`by synth which doesn't exist in any pool`, () => {
        const token = new Token({
            decimals: 6,
            symbol: 'USDC',
            name: 'syUSDC',
            chainId: ChainId.TELOS_MAINNET,
            address: '0xe6E5f3d264117E030C21920356641DbD5B3d660c',
            isNative: false,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
            },
            chainFromId: ChainId.ETH_MAINNET,
        })

        const pool = symbiosis.getOmniPoolByToken(token)
        expect(pool).toBe(undefined)
    })

    test(`another pool by synth`, () => {
        const token = new Token({
            decimals: 18,
            symbol: 'sWETH',
            name: 'Synthetic Wrapped Ether (Base)',
            chainId: ChainId.BOBA_BNB,
            address: '0x8eFFD39D090C756Db49A8154Db7BD05f59A62193',
            isNative: false,
            icons: {
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
            },
            chainFromId: ChainId.BASE_MAINNET,
        })

        const pool = symbiosis.getOmniPoolByToken(token)
        expect(pool?.id).toBe(1)
        expect(pool?.address).toBe('0xBcc2637DFa64999F75abB53a7265b5B4932e40eB')
        expect(pool?.chainId).toBe(ChainId.BOBA_BNB)
    })
})

describe('#transitToken', () => {
    describe('pool#0', () => {
        const omniPoolConfig = mainnet.omniPools[0]

        test('USDC is in Ethereum', () => {
            const token = symbiosis.transitToken(ChainId.ETH_MAINNET, omniPoolConfig)
            expect(token.chainId).toBe(ChainId.ETH_MAINNET)
            expect(token.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
        })
        test('BUSD is in BNB', () => {
            const token = symbiosis.transitToken(ChainId.BSC_MAINNET, omniPoolConfig)
            expect(token.chainId).toBe(ChainId.BSC_MAINNET)
            expect(token.address).toBe('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56')
        })
        test('USDC.e is in Avalanche', () => {
            const token = symbiosis.transitToken(ChainId.AVAX_MAINNET, omniPoolConfig)
            expect(token.chainId).toBe(ChainId.AVAX_MAINNET)
            expect(token.address).toBe('0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664')
        })
        test('USDC is in Polygon', () => {
            const chainId = ChainId.MATIC_MAINNET
            const address = '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDt is in Kava', () => {
            const chainId = ChainId.KAVA_MAINNET
            const address = '0x919C1c267BC06a7039e03fcc2eF738525769109c'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Boba Ethereum', () => {
            const chainId = ChainId.BOBA_MAINNET
            const address = '0x66a2A913e447d6b4BF33EFbec43aAeF87890FBbc'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Boba BNB', () => {
            const chainId = ChainId.BOBA_BNB
            const address = '0x9F98f9F312D23d078061962837042b8918e6aff2'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in ZkSync', () => {
            const chainId = ChainId.ZKSYNC_MAINNET
            const address = '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Arbitrum', () => {
            const chainId = ChainId.ARBITRUM_MAINNET
            const address = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Optimism', () => {
            const chainId = ChainId.OPTIMISM_MAINNET
            const address = '0x7F5c764cBc14f9669B88837ca1490cCa17c31607'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Arbitrum Nova', () => {
            const chainId = ChainId.ARBITRUM_NOVA
            const address = '0x750ba8b76187092B0D1E87E28daaf484d1b5273b'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Polygon zkEVM', () => {
            const chainId = ChainId.POLYGON_ZK
            const address = '0xA8CE8aee21bC2A48a5EF670afCc9274C7bbbC035'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Linea', () => {
            const chainId = ChainId.LINEA_MAINNET
            const address = '0x176211869cA2b568f2A7D4EE941E073a821EE1ff'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Mantle', () => {
            const chainId = ChainId.MANTLE_MAINNET
            const address = '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('USDC is in Base', () => {
            const chainId = ChainId.BASE_MAINNET
            const address = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
    })
    describe('pool#1', () => {
        const omniPoolConfig = mainnet.omniPools[1]

        test('WETH is in Ethereum', () => {
            const chainId = ChainId.ETH_MAINNET
            const address = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Polygon', () => {
            const chainId = ChainId.MATIC_MAINNET
            const address = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in ZkSync', () => {
            const chainId = ChainId.ZKSYNC_MAINNET
            const address = '0x5aea5775959fbc2557cc8789bc1bf90a239d9a91'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Arbitrum', () => {
            const chainId = ChainId.ARBITRUM_MAINNET
            const address = '0x82af49447d8a07e3bd95bd0d56f35241523fbab1'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Optimism', () => {
            const chainId = ChainId.OPTIMISM_MAINNET
            const address = '0x4200000000000000000000000000000000000006'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Arbitrum Nova', () => {
            const chainId = ChainId.ARBITRUM_NOVA
            const address = '0x722e8bdd2ce80a4422e880164f2079488e115365'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Polygon zkEVM', () => {
            const chainId = ChainId.POLYGON_ZK
            const address = '0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Linea', () => {
            const chainId = ChainId.LINEA_MAINNET
            const address = '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Mantle', () => {
            const chainId = ChainId.MANTLE_MAINNET
            const address = '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
        test('WETH is in Base', () => {
            const chainId = ChainId.BASE_MAINNET
            const address = '0x4200000000000000000000000000000000000006'.toLowerCase()

            const token = symbiosis.transitToken(chainId, omniPoolConfig)
            expect(token.chainId).toBe(chainId)
            expect(token.address.toLowerCase()).toBe(address)
        })
    })
})

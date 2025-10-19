import { describe, expect, test } from 'vitest'
import { ChainId, GAS_TOKEN, Symbiosis, WETH } from '../../../../src'
import { getRoutes, Route } from '../../../../src/crosschain/swapExactIn/crosschainSwap/bestPoolSwapping'
import { Token } from 'symbiosis-js-sdk'

const symbiosis = new Symbiosis('mainnet', 'test')

function shouldGoViaEth(result: Route, chainIdIn: ChainId, chainIdOut: ChainId) {
    expect(result.poolConfig.coinGeckoId).toEqual('weth')

    expect(result.transitTokenIn.chainId).toStrictEqual(chainIdIn)
    expect(result.transitTokenIn.address).toStrictEqual(WETH[chainIdIn].address)

    expect(result.transitTokenOut.chainId).toStrictEqual(chainIdOut)
    expect(result.transitTokenOut.address).toStrictEqual(WETH[chainIdOut].address)
}

const Ethereum_ETH = GAS_TOKEN[ChainId.ETH_MAINNET]
const Ethereum_WETH = WETH[ChainId.ETH_MAINNET]
const Ethereum_USDT = new Token({
    name: 'USDT',
    chainId: ChainId.ETH_MAINNET,
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
})
const Ethereum_USDC = new Token({
    name: 'USDC',
    chainId: ChainId.ETH_MAINNET,
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
})
const Ethereum_SIS = new Token({
    name: 'SIS',
    chainId: ChainId.ETH_MAINNET,
    address: '0xd38BB40815d2B0c2d2c866e0c72c5728ffC76dd9',
    decimals: 18,
})
const Ethereum_UNI = new Token({
    name: 'UNI',
    chainId: ChainId.ETH_MAINNET,
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    decimals: 18,
})

const Blast_ETH = GAS_TOKEN[ChainId.BLAST_MAINNET]

const Base_ETH = GAS_TOKEN[ChainId.BASE_MAINNET]
const Base_WETH = WETH[ChainId.BASE_MAINNET]

const Arbitrum_ETH = GAS_TOKEN[ChainId.ARBITRUM_MAINNET]
const Arbitrum_WETH = WETH[ChainId.ARBITRUM_MAINNET]
const Arbitrum_USDC = new Token({
    name: 'USDC',
    chainId: ChainId.ARBITRUM_MAINNET,
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    decimals: 6,
})
const Arbitrum_SIS = new Token({
    name: 'SIS',
    chainId: ChainId.ARBITRUM_MAINNET,
    address: '0x9E758B8a98a42d612b3D38B66a22074DC03D7370',
    decimals: 18,
})
const Arbitrum_USDT = new Token({
    name: 'USDT',
    chainId: ChainId.ARBITRUM_MAINNET,
    address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    decimals: 6,
})

describe('#getRoutes', () => {
    describe('Routing enabled', () => {
        test('Ethereum.ETH -> Base.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_ETH,
                tokenOut: Base_ETH,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.WETH -> Base.WETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_WETH,
                tokenOut: Base_WETH,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.USDT -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_ETH,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.ARBITRUM_MAINNET)
        })

        test('Ethereum.USDC -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDC,
                tokenOut: Arbitrum_WETH,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.ARBITRUM_MAINNET)
        })

        test('Ethereum.SIS -> Arbitrum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_SIS,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })

        test('Ethereum.USDT -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_USDT,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(false)
            expect(result.poolConfig.coinGeckoId).toEqual('usd-coin')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_USDC.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_USDC.address)
        })
        test('Ethereum.SIS -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_USDT,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })
        test('Arbitrum.USDT -> Ethereum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_SIS,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Arbitrum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Ethereum_SIS.address)
        })
        test('Arbitrum.USDT -> Ethereum.UNI', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_UNI,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(false)
            expect(result.poolConfig.coinGeckoId).toEqual('usd-coin')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Arbitrum_USDC.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Ethereum_USDC.address)
        })
        test('Arbitrum.USDT -> Blast.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Blast_ETH,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ARBITRUM_MAINNET, ChainId.BLAST_MAINNET)
        })
    })

    describe('Source chain routing disabled', () => {
        const disableSrcChainRouting = true
        test('Ethereum.ETH -> Base.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_ETH,
                tokenOut: Base_ETH,
                disableSrcChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.WETH -> Base.WETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_WETH,
                tokenOut: Base_WETH,
                disableSrcChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.USDT -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_ETH,
                disableSrcChainRouting,
            })
            expect(results.length).toEqual(0)
        })

        test('Ethereum.USDC -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDC,
                tokenOut: Arbitrum_WETH,
                disableSrcChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('usd-coin')
            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_USDC.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_USDC.address)
        })

        test('Ethereum.SIS -> Arbitrum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_SIS,
                disableSrcChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })

        test('Ethereum.USDT -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_USDT,
                disableSrcChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Ethereum.SIS -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_USDT,
                disableSrcChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })
        test('Arbitrum.USDT -> Ethereum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_SIS,
                disableSrcChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Ethereum.UNI', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_UNI,
                disableSrcChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Blast.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Blast_ETH,
                disableSrcChainRouting,
            })
            expect(results.length).toEqual(0)
        })
    })

    describe('Destination chain routing disabled', () => {
        const disableDstChainRouting = true
        test('Ethereum.ETH -> Base.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_ETH,
                tokenOut: Base_ETH,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.WETH -> Base.WETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_WETH,
                tokenOut: Base_WETH,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.USDT -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_ETH,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.ARBITRUM_MAINNET)
        })

        test('Ethereum.USDC -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDC,
                tokenOut: Arbitrum_WETH,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.ARBITRUM_MAINNET)
        })

        test('Ethereum.SIS -> Arbitrum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_SIS,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })

        test('Ethereum.USDT -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_USDT,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Ethereum.SIS -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_USDT,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Ethereum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_SIS,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Arbitrum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Ethereum_SIS.address)
        })
        test('Arbitrum.USDT -> Ethereum.UNI', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_UNI,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Blast.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Blast_ETH,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ARBITRUM_MAINNET, ChainId.BLAST_MAINNET)
        })
    })

    describe('Routing disabled', () => {
        const disableSrcChainRouting = true
        const disableDstChainRouting = true

        test('Ethereum.ETH -> Base.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_ETH,
                tokenOut: Base_ETH,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.WETH -> Base.WETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_WETH,
                tokenOut: Base_WETH,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            shouldGoViaEth(result, ChainId.ETH_MAINNET, ChainId.BASE_MAINNET)
        })

        test('Ethereum.USDT -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_ETH,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })

        test('Ethereum.USDC -> Arbitrum.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDC,
                tokenOut: Arbitrum_WETH,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })

        test('Ethereum.SIS -> Arbitrum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_SIS,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).not.toEqual(0)
            const result = results[0]
            expect(result.optimal).toEqual(true)
            expect(result.poolConfig.coinGeckoId).toEqual('symbiosis-finance')

            expect(result.transitTokenIn.chainId).toStrictEqual(ChainId.ETH_MAINNET)
            expect(result.transitTokenIn.address).toStrictEqual(Ethereum_SIS.address)

            expect(result.transitTokenOut.chainId).toStrictEqual(ChainId.ARBITRUM_MAINNET)
            expect(result.transitTokenOut.address).toStrictEqual(Arbitrum_SIS.address)
        })

        test('Ethereum.USDT -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_USDT,
                tokenOut: Arbitrum_USDT,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Ethereum.SIS -> Arbitrum.USDT', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Ethereum_SIS,
                tokenOut: Arbitrum_USDT,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Ethereum.SIS', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_SIS,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Ethereum.UNI', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Ethereum_UNI,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
        test('Arbitrum.USDT -> Blast.ETH', () => {
            const results = getRoutes({
                symbiosis,
                tokenIn: Arbitrum_USDT,
                tokenOut: Blast_ETH,
                disableSrcChainRouting,
                disableDstChainRouting,
            })
            expect(results.length).toEqual(0)
        })
    })
})

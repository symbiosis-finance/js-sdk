import BNJS from 'bignumber.js'
import { BigNumber } from 'ethers'
import { AbiCoder } from 'ethers/lib/utils'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { BIPS_BASE } from '../constants'
import { IzumiFactory__factory, IzumiPool__factory, IzumiQuoter__factory, IzumiSwap__factory } from '../contracts'
import { getMulticall } from '../multicall'
import { Symbiosis } from '../symbiosis'
import { getMinAmount } from '../chainUtils'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { Multicall2 } from '../contracts/Multicall'

interface IzumiAddresses {
    factory: string
    quoter: string
    swap: string
    baseTokens: Token[]
}

interface IzumiRoute {
    tokens: Token[]
    fees: number[]
    path: string
}

const POSSIBLE_FEES = [100, 400, 500, 2000, 3000, 10000]

const IZUMI_ADDRESSES: Partial<Record<ChainId, IzumiAddresses>> = {
    [ChainId.MANTLE_MAINNET]: {
        factory: '0x45e5F26451CDB01B0fA1f8582E0aAD9A6F27C218',
        quoter: '0x032b241De86a8660f1Ae0691a4760B426EA246d7',
        swap: '0x25C030116Feb2E7BbA054b9de0915E5F51b03e31',
        baseTokens: [
            new Token({
                chainId: ChainId.MANTLE_MAINNET,
                address: '0x201eba5cc46d216ce6dc03f6a759e8e766e956ae',
                decimals: 6,
                symbol: 'USDT',
                name: 'USDT',
            }),
            new Token({
                chainId: ChainId.MANTLE_MAINNET,
                address: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead1111',
                decimals: 18,
                symbol: 'WETH',
                name: 'Wrapped Ether',
            }),
            new Token({
                chainId: ChainId.MANTLE_MAINNET,
                address: '0x78c1b0c915c4faa5fffa6cabf0219da63d7f4cb8',
                decimals: 18,
                symbol: 'WMNT',
                name: 'WMNT',
            }),
            new Token({
                chainId: ChainId.MANTLE_MAINNET,
                address: '0x0a3bb08b3a15a19b4de82f8acfc862606fb69a2d',
                decimals: 18,
                symbol: 'iUSD',
                name: 'iZUMi Bond USD',
            }),
        ],
    },
    [ChainId.LINEA_MAINNET]: {
        factory: '0x45e5F26451CDB01B0fA1f8582E0aAD9A6F27C218',
        quoter: '0xe6805638db944eA605e774e72c6F0D15Fb6a1347',
        swap: '0x032b241De86a8660f1Ae0691a4760B426EA246d7',
        baseTokens: [
            new Token({
                chainId: ChainId.LINEA_MAINNET,
                name: 'Wrapped Ether',
                symbol: 'WETH',
                address: '0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.LINEA_MAINNET,
                name: 'iZUMi Bond USD',
                symbol: 'iUSD',
                address: '0x0a3bb08b3a15a19b4de82f8acfc862606fb69a2d',
                decimals: 18,
            }),
        ],
    },
    [ChainId.SCROLL_MAINNET]: {
        factory: '0x8c7d3063579BdB0b90997e18A770eaE32E1eBb08',
        quoter: '0x33531bDBFE34fa6Fd5963D0423f7699775AacaaF',
        swap: '0x2db0AFD0045F3518c77eC6591a542e326Befd3D7',
        baseTokens: [
            new Token({
                chainId: ChainId.SCROLL_MAINNET,
                name: 'Wrapped Ether',
                symbol: 'WETH',
                address: '0x5300000000000000000000000000000000000004',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.SCROLL_MAINNET,
                name: 'USD Coin',
                symbol: 'USDC',
                address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
                decimals: 18,
            }),
        ],
    },
    [ChainId.OKX_X1_TESTNET]: {
        factory: '0x64c2F1306b4ED3183E7B345158fd01c19C0d8c5E',
        quoter: '0xF6FFe4f3FdC8BBb7F70FFD48e61f17D1e343dDfD',
        swap: '0xa9754f0D9055d14EB0D2d196E4C51d8B2Ee6f4d3',
        baseTokens: [
            new Token({
                name: 'WETH',
                symbol: 'WETH',
                address: '0xbec7859bc3d0603bec454f7194173e36bf2aa5c8',
                chainId: ChainId.OKX_X1_TESTNET,
                decimals: 18,
                icons: {
                    large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png',
                    small: 'https://s2.coinmarketcap.com/static/img/coins/128x128/1027.png',
                },
            }),
            new Token({
                chainId: ChainId.OKX_X1_TESTNET,
                address: '0x67A1f4A939b477A6b7c5BF94D97E45dE87E608eF',
                decimals: 18,
                symbol: 'WOKB',
                isNative: false,
                name: 'Wrapped OKB',
                icons: {
                    small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3897.png',
                    large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3897.png',
                },
            }),
        ],
    },
    [ChainId.MERLIN_MAINNET]: {
        swap: '0x1aFa5D7f89743219576Ef48a9826261bE6378a68',
        factory: '0xE29a6620DAc789B8a76e9b9eC8fE9B7cf2B663D5',
        quoter: '0x2569bcE69287618e2cd004f785d016F7DF29232F',
        baseTokens: [
            new Token({
                chainId: ChainId.MERLIN_MAINNET,
                name: 'Wrapped BTC',
                symbol: 'WBTC',
                address: '0xF6D226f9Dc15d9bB51182815b320D3fBE324e1bA',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.MERLIN_MAINNET,
                name: 'iZUMi Bond USD',
                symbol: 'iUSD',
                address: '0x0A3BB08b3a15A19b4De82F8AcFc862606FB69A2D',
                decimals: 18,
            }),
        ],
    },
    [ChainId.ZKLINK_MAINNET]: {
        swap: '0x377EC7c9ae5a0787F384668788a1654249059dD6',
        factory: '0x33D9936b7B7BC155493446B5E6dDC0350EB83AEC',
        quoter: '0x3EC82C07981D6D213DA9bd35A0ba4cd324feA438',
        baseTokens: [
            new Token({
                chainId: ChainId.ZKLINK_MAINNET,
                name: 'Wrapped ETH',
                symbol: 'WETH',
                address: '0x8280a4e7D5B3B658ec4580d3Bc30f5e50454F169',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.ZKLINK_MAINNET,
                name: 'Tether USD (Ethereum)',
                symbol: 'USDT.Eth',
                address: '0x0ace5E8e1Be0d3Df778f639d79fa8231b376b9F1',
                decimals: 6,
            }),
            new Token({
                chainId: ChainId.ZKLINK_MAINNET,
                name: 'USD Coin (Ethereum)',
                symbol: 'USDC.Eth',
                address: '0x220B1C622c8c169a9174f42CEA89a9E2f83B63F6',
                decimals: 6,
            }),
            new Token({
                chainId: ChainId.ZKLINK_MAINNET,
                name: 'USD Coin (Arbitrum)',
                symbol: 'USDC.Arbi',
                address: '0x7581469cb53E786F39ff26E8aF6Fd750213dAcEd',
                decimals: 6,
            }),
        ],
    },
    [ChainId.ZETACHAIN_MAINNET]: {
        swap: '0x34bc1b87f60e0a30c0e24FD7Abada70436c71406',
        factory: '0x8c7d3063579BdB0b90997e18A770eaE32E1eBb08',
        quoter: '0x3F559139C2Fc7B97Ad6FE9B4d1f75149F551DB18',
        baseTokens: [
            new Token({
                chainId: ChainId.ZETACHAIN_MAINNET,
                name: 'Wrapped ZETA',
                symbol: 'WZETA',
                address: '0x5F0b1a82749cb4E2278EC87F8BF6B618dC71a8bf',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.ZETACHAIN_MAINNET,
                name: 'ZetaChain ZRC20 USDT on ETH',
                symbol: 'USDT.ETH',
                address: '0x7c8dDa80bbBE1254a7aACf3219EBe1481c6E01d7',
                decimals: 6,
            }),
            new Token({
                chainId: ChainId.ZETACHAIN_MAINNET,
                name: 'ZetaChain ZRC20 USDC on ETH',
                symbol: 'USDC.ETH',
                address: '0x0cbe0dF132a6c6B4a2974Fa1b7Fb953CF0Cc798a',
                decimals: 6,
            }),
            new Token({
                chainId: ChainId.ZETACHAIN_MAINNET,
                name: 'ZetaChain ZRC20 ETH-eth_mainnet',
                symbol: 'ETH.ETH',
                address: '0xd97B1de3619ed2c6BEb3860147E30cA8A7dC9891',
                decimals: 18,
            }),
        ],
    },
    [ChainId.TAIKO_MAINNET]: {
        swap: '0x04830cfCED9772b8ACbAF76Cfc7A630Ad82c9148',
        factory: '0x8c7d3063579BdB0b90997e18A770eaE32E1eBb08',
        quoter: '0x2C6Df0fDbCE9D2Ded2B52A117126F2Dc991f770f',
        baseTokens: [],
    },
    [ChainId.GRAVITY_MAINNET]: {
        swap: '0x3EF68D3f7664b2805D4E88381b64868a56f88bC4',
        factory: '0x8c7d3063579BdB0b90997e18A770eaE32E1eBb08',
        quoter: '0x33531bDBFE34fa6Fd5963D0423f7699775AacaaF',
        baseTokens: [],
    },
    [ChainId.MORPH_MAINNET]: {
        swap: '0x3EF68D3f7664b2805D4E88381b64868a56f88bC4',
        factory: '0x8c7d3063579BdB0b90997e18A770eaE32E1eBb08',
        quoter: '0x33531bDBFE34fa6Fd5963D0423f7699775AacaaF',
        baseTokens: [],
    },
}

interface IzumiTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
}

export class IzumiTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly deadline: number

    static isSupported(chainId: ChainId): boolean {
        return !!IZUMI_ADDRESSES[chainId]
    }

    public constructor(params: IzumiTradeParams) {
        super(params)

        const { symbiosis, deadline } = params
        this.symbiosis = symbiosis
        this.deadline = deadline
    }

    get tradeType(): SymbiosisTradeType {
        return 'izumi'
    }

    public async init() {
        const addresses = IZUMI_ADDRESSES[this.tokenAmountIn.token.chainId]

        if (!addresses) {
            throw new Error('Unsupported chain')
        }

        const { quoter, swap } = addresses

        const allRoutes: IzumiRoute[] = []

        const tokenIn = this.tokenAmountIn.token
        const tokenOut = this.tokenOut

        POSSIBLE_FEES.forEach((fee) => {
            const path = getTokenChainPath([tokenIn, tokenOut], [fee])
            allRoutes.push({ tokens: [tokenIn, tokenOut], path, fees: [fee] })
        })

        const wrappedTokenIn = wrappedToken(tokenIn)
        const wrappedTokenOut = wrappedToken(tokenOut)

        for (const baseToken of addresses.baseTokens) {
            if (baseToken.equals(wrappedTokenIn) || baseToken.equals(wrappedTokenOut)) {
                continue
            }

            POSSIBLE_FEES.forEach((firstFee) => {
                POSSIBLE_FEES.forEach((secondFee) => {
                    const fees = [firstFee, secondFee]

                    const path = getTokenChainPath([tokenIn, baseToken, tokenOut], fees)
                    allRoutes.push({ tokens: [tokenIn, baseToken, tokenOut], path, fees })
                })
            })
        }

        const provider = this.symbiosis.getProvider(this.tokenAmountIn.token.chainId)

        const multicall = await getMulticall(provider)

        const quoterInterface = IzumiQuoter__factory.createInterface()

        const calls = allRoutes.map(({ path }) => ({
            target: quoter,
            callData: quoterInterface.encodeFunctionData('swapAmount', [this.tokenAmountIn.raw.toString(), path]),
        }))

        const maxChunkLength = 100
        const chunks = Math.floor(calls.length / maxChunkLength) + 1

        let results: Multicall2.ResultStructOutput[] = []
        for (let i = 0; i < chunks; i++) {
            const from = i * maxChunkLength
            let to = (i + 1) * maxChunkLength
            if (to > calls.length) {
                to = calls.length
            }
            const callsPart = calls.slice(from, to)
            const part = await multicall.callStatic.tryAggregate(false, callsPart)
            results = [...results, ...part]
        }

        let bestRoute: IzumiRoute | undefined
        let bestOutput: BigNumber | undefined
        for (let i = 0; i < results.length; i++) {
            const [success, returnData] = results[i]
            if (!success) {
                continue
            }

            const { acquire } = quoterInterface.decodeFunctionResult('swapAmount', returnData)
            if (!bestOutput || BigNumber.from(acquire).gt(bestOutput)) {
                bestRoute = allRoutes[i]
                bestOutput = acquire
            }
        }

        if (!bestRoute || !bestOutput) {
            throw new Error('No path found')
        }

        const { path, tokens } = bestRoute
        const pointsBefore = await this.getCurrentPoolPoints(bestRoute)
        const initDecimalPriceEndByStart = getPriceDecimalEndByStart(bestRoute, pointsBefore)
        const initDecimalPriceEndByStartTrimmed = new BNJS(initDecimalPriceEndByStart.toFixed(4))

        let priceImpact = new Percent('0', BIPS_BASE)

        if (!initDecimalPriceEndByStartTrimmed.isEqualTo('0')) {
            const spotPriceBNJS = new BNJS(this.tokenAmountIn.raw.toString())
                .dividedBy(10 ** this.tokenAmountIn.token.decimals)
                .dividedBy(initDecimalPriceEndByStart)

            const bestOutputBNJS = new BNJS(bestOutput.toString()).dividedBy(10 ** this.tokenOut.decimals)
            const impactBNJS = spotPriceBNJS.minus(bestOutputBNJS).div(bestOutputBNJS).negated()

            priceImpact = new Percent(impactBNJS.times(BIPS_BASE.toString()).toFixed(0).toString(), BIPS_BASE)
        }

        const amountOut = new TokenAmount(this.tokenOut, bestOutput.toString())

        const minAcquired = getMinAmount(this.slippage, bestOutput.toString())
        const amountOutMin = new TokenAmount(this.tokenOut, minAcquired.toString())

        const outputToken = tokens[tokens.length - 1]

        const finalRecipientAddress = this.to
        const innerRecipientAddress = outputToken.isNative
            ? '0x0000000000000000000000000000000000000000'
            : finalRecipientAddress

        const swapInterface = IzumiSwap__factory.createInterface()

        const swapCalls: string[] = []

        const swapData = swapInterface.encodeFunctionData('swapAmount', [
            {
                path,
                recipient: innerRecipientAddress,
                amount: this.tokenAmountIn.raw.toString(),
                minAcquired: minAcquired.toString(),
                deadline: this.deadline,
            },
        ])

        swapCalls.push(swapData)
        if (outputToken.isNative) {
            swapCalls.push(swapInterface.encodeFunctionData('unwrapWETH9', ['0', finalRecipientAddress]))
        }

        let callData: string
        if (swapCalls.length === 1) {
            callData = swapCalls[0]
        } else {
            callData = swapInterface.encodeFunctionData('multicall', [swapCalls])
        }

        const abiCoder = new AbiCoder()

        const amountInCallData = abiCoder.encode(['uint128'], [this.tokenAmountIn.raw.toString()]).replace('0x', '')
        const amountPosition = callData.indexOf(amountInCallData) + amountInCallData.length
        const callDataOffset = (amountPosition - 2) / 2 // Exclude the 0x from calculating the offset

        const minReceivedCallData = abiCoder.encode(['uint128'], [minAcquired.toString()]).replace('0x', '')
        const minReceivedPosition = callData.indexOf(minReceivedCallData) + minReceivedCallData.length
        const minReceivedOffset = (minReceivedPosition - 2) / 2 // Exclude the 0x from calculating the offset

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: swap,
            route: tokens,
            callData,
            callDataOffset,
            minReceivedOffset,
            priceImpact,
        }
        return this
    }

    async getCurrentPoolPoints({ fees, tokens }: IzumiRoute) {
        const addresses = IZUMI_ADDRESSES[this.tokenAmountIn.token.chainId]

        if (!addresses) {
            throw new Error('Unsupported chain')
        }

        const provider = this.symbiosis.getProvider(this.tokenAmountIn.token.chainId)

        const multicall = await getMulticall(provider)

        const factoryInterface = IzumiFactory__factory.createInterface()

        const getPoolAddressesCalls: {
            target: string
            callData: string
        }[] = []
        for (let i = 0; i < fees.length; i++) {
            getPoolAddressesCalls.push({
                target: addresses.factory,
                callData: factoryInterface.encodeFunctionData('pool', [
                    wrappedToken(tokens[i]).address,
                    wrappedToken(tokens[i + 1]).address,
                    fees[i],
                ]),
            })
        }

        const getPoolAddressesResults = await multicall.callStatic.tryAggregate(false, getPoolAddressesCalls)
        const poolsAddresses: string[] = getPoolAddressesResults.map(
            ([, returnData]) => factoryInterface.decodeFunctionResult('pool', returnData)[0]
        )

        const poolInterface = IzumiPool__factory.createInterface()

        const statesResults = await multicall.callStatic.tryAggregate(
            false,
            poolsAddresses.map((poolAddress) => ({
                target: poolAddress,
                callData: poolInterface.encodeFunctionData('state'),
            }))
        )

        const points = statesResults.map(
            ([, returnData]) => poolInterface.decodeFunctionResult('state', returnData).currentPoint
        )

        return points
    }
}

/**
 * Inner functions from izumi-sdk
 */
function num2Hex(n: number) {
    if (n < 10) {
        return String(n)
    }
    const str = 'ABCDEF'
    return str[n - 10]
}

function appendHex(hexString: string, newHexString: string): string {
    return hexString + newHexString.slice(2)
}

function fee2Hex(fee: number): string {
    const n0 = fee % 16
    const n1 = Math.floor(fee / 16) % 16
    const n2 = Math.floor(fee / 256) % 16
    const n3 = Math.floor(fee / 4096) % 16
    const n4 = 0
    const n5 = 0
    return '0x' + num2Hex(n5) + num2Hex(n4) + num2Hex(n3) + num2Hex(n2) + num2Hex(n1) + num2Hex(n0)
}

export const getTokenChainPath = (tokenChain: Token[], feeChain: number[]): string => {
    let hexString = wrappedToken(tokenChain[0]).address
    for (let i = 0; i < feeChain.length; i++) {
        hexString = appendHex(hexString, fee2Hex(feeChain[i]))
        hexString = appendHex(hexString, wrappedToken(tokenChain[i + 1]).address)
    }
    return hexString
}

export const getTokenXYFromToken = (
    tokenA: Token,
    tokenB: Token
): {
    tokenX: Token
    tokenY: Token
} => {
    const addressA = wrappedToken(tokenA).address
    const addressB = wrappedToken(tokenB).address

    if (addressA.toLowerCase() < addressB.toLowerCase()) {
        return { tokenX: tokenA, tokenY: tokenB }
    }

    return { tokenX: tokenB, tokenY: tokenA }
}

export const priceUndecimal2PriceDecimal = (tokenA: Token, tokenB: Token, priceUndecimalAByB: BNJS): number => {
    // priceUndecimalAByB * amountA = amountB
    // priceUndecimalAByB * amountADecimal * 10^decimalA = amountBDecimal * 10^decimalB
    // priceUndecimalAByB * 10^decimalA / 10^decimalB * amountA = amountB
    return Number(priceUndecimalAByB.times(10 ** tokenA.decimals).div(10 ** tokenB.decimals))
}

export const point2PriceDecimal = (tokenA: Token, tokenB: Token, point: number): number => {
    let priceDecimal = 0
    let needReverse = false
    const { tokenX, tokenY } = getTokenXYFromToken(tokenA, tokenB)

    const addressA = wrappedToken(tokenA).address
    const addressB = wrappedToken(tokenB).address

    if (point > 0) {
        priceDecimal = priceUndecimal2PriceDecimal(tokenX, tokenY, new BNJS(1.0001 ** point))
        needReverse = addressA.toLowerCase() > addressB.toLowerCase()
    } else {
        priceDecimal = priceUndecimal2PriceDecimal(tokenY, tokenX, new BNJS(1.0001 ** -point))
        needReverse = addressA.toLowerCase() < addressB.toLowerCase()
    }
    if (needReverse) {
        priceDecimal = 1 / priceDecimal
    }
    return priceDecimal
}

export function getPriceDecimalEndByStart(route: IzumiRoute, points: number[]): number {
    const { tokens, fees } = route

    let decimalPriceEndByStart = 1
    for (let i = 0; i < fees.length; i++) {
        const decimalPriceBackByFront = point2PriceDecimal(tokens[i + 1], tokens[i], points[i])
        decimalPriceEndByStart *= decimalPriceBackByFront
    }

    return decimalPriceEndByStart
}

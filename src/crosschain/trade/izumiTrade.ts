import { BigNumber } from 'ethers'
import { ChainId, ONE } from '../../constants'
import { Fraction, Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { getMulticall } from '../multicall'
import { Symbiosis } from '../symbiosis'
import type { SymbiosisTrade } from './symbiosisTrade'
import { IzumiQuoter__factory, IzumiSwap__factory } from '../contracts'
import { basisPointsToPercent } from '../utils'
import { AbiCoder } from 'ethers/lib/utils'

interface IzumiAddresses {
    quoter: string
    swap: string
    baseTokens: Token[]
}

interface IzumiRoute {
    tokens: Token[]
    path: string
}

interface IzumiTradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    slippage: number
    ttl: number
    to: string
}

const POSSIBLE_FEES = [100, 400, 500, 2000, 3000, 10000]

const IZUMI_ADDRESSES: Partial<Record<ChainId, IzumiAddresses>> = {
    [ChainId.MANTLE_MAINNET]: {
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
    [ChainId.BASE_MAINNET]: {
        quoter: '0x2db0AFD0045F3518c77eC6591a542e326Befd3D7',
        swap: '0x02F55D53DcE23B4AA962CC68b0f685f26143Bdb2',
        baseTokens: [
            new Token({
                chainId: ChainId.BASE_MAINNET,
                name: 'Wrapped Ether',
                symbol: 'WETH',
                address: '0x4200000000000000000000000000000000000006',
                decimals: 18,
            }),
            new Token({
                chainId: ChainId.BASE_MAINNET,
                symbol: 'iUSD',
                name: 'iZUMi Bond USD',
                address: '0x0a3bb08b3a15a19b4de82f8acfc862606fb69a2d',
                decimals: 18,
            }),
        ],
    },
}

export class IzumiTrade implements SymbiosisTrade {
    tradeType = 'dex' as const

    public priceImpact: Percent = new Percent('0')
    private readonly symbiosis: Symbiosis
    public readonly tokenAmountIn: TokenAmount
    private readonly tokenOut: Token
    private readonly slippage: number
    private readonly ttl: number
    private readonly to: string

    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    static isSupported(chainId: ChainId): boolean {
        return !!IZUMI_ADDRESSES[chainId]
    }

    public constructor(params: IzumiTradeParams) {
        const { symbiosis, tokenAmountIn, tokenOut, slippage, ttl, to } = params

        this.symbiosis = symbiosis
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.slippage = slippage
        this.ttl = ttl
        this.to = to
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
            allRoutes.push({ tokens: [tokenIn, tokenOut], path })
        })

        for (const baseToken of addresses.baseTokens) {
            if (baseToken.equals(this.tokenAmountIn.token) || baseToken.equals(this.tokenOut)) {
                continue
            }

            POSSIBLE_FEES.forEach((firstFee) => {
                POSSIBLE_FEES.forEach((secondFee) => {
                    const path = getTokenChainPath([tokenIn, baseToken, tokenOut], [firstFee, secondFee])
                    allRoutes.push({ tokens: [tokenIn, baseToken, tokenOut], path })
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

        const results = await multicall.callStatic.tryAggregate(false, calls)

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

        this.amountOut = new TokenAmount(this.tokenOut, bestOutput.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const minAcquired = new Fraction(ONE).add(slippageTolerance).invert().multiply(this.amountOut.raw).quotient

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
                deadline: Math.floor(Date.now() / 1000) + this.ttl,
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
        const encodedCallData = abiCoder.encode(['uint128'], [this.tokenAmountIn.raw.toString()]).replace('0x', '')
        const position = callData.indexOf(encodedCallData) + encodedCallData.length

        // Exclude the 0x from calculating the offset
        this.callDataOffset = (position - 2) / 2

        this.routerAddress = swap
        this.callData = callData

        this.route = tokens

        return this
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

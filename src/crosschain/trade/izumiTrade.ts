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
}

const POSSIBLE_FEES = [100, 400, 500, 2000, 3000, 10000]

const IZUMI_ADDRESSES: Partial<Record<ChainId, IzumiAddresses>> = {
    [ChainId.MANTLE_MAINNET]: {
        quoter: '0x032b241De86a8660f1Ae0691a4760B426EA246d7',
        swap: '0x25C030116Feb2E7BbA054b9de0915E5F51b03e31',
    },
    [ChainId.LINEA_MAINNET]: {
        quoter: '0xe6805638db944eA605e774e72c6F0D15Fb6a1347',
        swap: '0x032b241De86a8660f1Ae0691a4760B426EA246d7',
    },
    [ChainId.BASE_MAINNET]: {
        quoter: '0x2db0AFD0045F3518c77eC6591a542e326Befd3D7',
        swap: '0x02F55D53DcE23B4AA962CC68b0f685f26143Bdb2',
    },
}

export class IzumiTrade implements SymbiosisTrade {
    tradeType = 'dex' as const

    public priceImpact: Percent = new Percent('0')

    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    static isSupported(chainId: ChainId): boolean {
        return !!IZUMI_ADDRESSES[chainId]
    }

    public constructor(
        private readonly symbiosis: Symbiosis,
        public readonly tokenAmountIn: TokenAmount,
        private readonly tokenOut: Token,
        private readonly slippage: number,
        private readonly deadline: number,
        private readonly to: string
    ) {}

    public async init() {
        const addresses = IZUMI_ADDRESSES[this.tokenAmountIn.token.chainId]

        if (!addresses) {
            throw new Error('Unsupported chain')
        }

        const { quoter, swap } = addresses

        const provider = this.symbiosis.getProvider(this.tokenAmountIn.token.chainId)

        const paths = POSSIBLE_FEES.map((fee) => getTokenChainPath([this.tokenAmountIn.token, this.tokenOut], [fee]))

        const multicall = await getMulticall(provider)

        const quoterInterface = IzumiQuoter__factory.createInterface()

        const calls = paths.map((path) => ({
            target: quoter,
            callData: quoterInterface.encodeFunctionData('swapAmount', [this.tokenAmountIn.raw.toString(), path]),
        }))

        const results = await multicall.callStatic.tryAggregate(false, calls)

        let bestPath: string | undefined
        let bestOutput: BigNumber | undefined
        for (let i = 0; i < results.length; i++) {
            const [success, returnData] = results[i]
            if (!success) {
                continue
            }

            const { acquire } = quoterInterface.decodeFunctionResult('swapAmount', returnData)
            if (!bestOutput || BigNumber.from(acquire).gt(bestOutput)) {
                bestPath = paths[i]
                bestOutput = acquire
            }
        }

        if (!bestPath || !bestOutput) {
            throw new Error('No path found')
        }

        this.amountOut = new TokenAmount(this.tokenOut, bestOutput.toString())

        const slippageTolerance = basisPointsToPercent(this.slippage)
        const minAcquired = new Fraction(ONE).add(slippageTolerance).invert().multiply(this.amountOut.raw).quotient

        const tokenChain = [this.tokenAmountIn.token, this.tokenOut]

        const outputToken = tokenChain[tokenChain.length - 1]
        const path = bestPath

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
                deadline: Math.floor(Date.now() / 1000) + this.deadline,
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
        console.log(this.callDataOffset)

        this.routerAddress = swap
        this.callData = callData

        this.route = [this.tokenAmountIn.token, this.tokenOut]

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

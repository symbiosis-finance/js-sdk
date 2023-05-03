import fetch from 'isomorphic-unfetch'
import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { OneInchOracle } from '../contracts'
import { DataProvider } from '../dataProvider'
import { canOneInch } from '../utils'
import { getTradePriceImpact } from './getTradePriceImpact'
import { SymbiosisTrade } from './symbiosisTrade'

export type OneInchProtocols = string[]

interface Protocol {
    id: string
    title: string
    img: string
    img_color: string
}

const API_URL = 'https://api-symbiosis.1inch.io'
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as const

export class OneInchTrade implements SymbiosisTrade {
    tradeType = '1inch' as const

    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public priceImpact!: Percent
    public routerAddress!: string
    public oracle: OneInchOracle
    public callDataOffset?: number

    private readonly tokenOut: Token
    private readonly from: string
    private readonly to: string
    private readonly slippage: number
    private readonly dataProvider: DataProvider
    private readonly protocols: OneInchProtocols

    static isAvailable(chainId: ChainId): boolean {
        return canOneInch(chainId)
    }

    public constructor(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        slippage: number,
        oracle: OneInchOracle,
        dataProvider: DataProvider,
        protocols?: OneInchProtocols
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.slippage = slippage
        this.oracle = oracle
        this.dataProvider = dataProvider
        this.protocols = protocols || []
    }

    public async init() {
        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = NATIVE_TOKEN_ADDRESS
        }

        let protocols = this.protocols
        if (protocols.length === 0) {
            protocols = await this.dataProvider.getOneInchProtocols(this.tokenAmountIn.token.chainId)
        }

        const url = new URL(`v5.0/${this.tokenAmountIn.token.chainId}/swap`, API_URL)

        url.searchParams.set('fromTokenAddress', fromTokenAddress)
        url.searchParams.set('toTokenAddress', toTokenAddress)
        url.searchParams.set('amount', this.tokenAmountIn.raw.toString())
        url.searchParams.set('fromAddress', this.from)
        url.searchParams.set('destReceiver', this.to)
        url.searchParams.set('slippage', this.slippage.toString())
        url.searchParams.set('disableEstimate', 'true')
        url.searchParams.set('allowPartialFill', 'false')
        url.searchParams.set('usePatching', 'true')
        url.searchParams.set('protocols', protocols.join(','))

        const response = await fetch(url.toString())

        const json = await response.json()

        if (response.status === 400) {
            throw new Error(`Cannot build 1inch trade: ${json['description']}`)
        }

        const tx: {
            from: string
            to: string
            data: string
            value: string
            gas: string
            gasPrice: string
        } = json['tx']
        const amountOutRaw: string = json['toTokenAmount']

        this.routerAddress = tx.to
        this.callData = tx.data
        this.callDataOffset = this.getOffset(tx.data)
        this.amountOut = new TokenAmount(this.tokenOut, amountOutRaw)
        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.priceImpact = await getTradePriceImpact({
            dataProvider: this.dataProvider,
            oracle: this.oracle,
            tokenAmountIn: this.tokenAmountIn,
            tokenAmountOut: this.amountOut,
        })

        return this
    }

    static async getProtocols(chainId: ChainId): Promise<OneInchProtocols> {
        const url = `${API_URL}/v5.0/${chainId}/liquidity-sources`
        const response = await fetch(url)
        const json = await response.json()
        if (response.status === 400) {
            throw new Error(`Cannot get 1inch protocols: ${json['description']}`)
        }
        return json['protocols'].reduce((acc: OneInchProtocols, protocol: Protocol) => {
            if (protocol.id.includes('ONE_INCH_LIMIT_ORDER')) {
                return acc
            }
            if (protocol.id.includes('PMM')) {
                return acc
            }
            acc.push(protocol.id)
            return acc
        }, [])
    }

    private getOffset(callData: string) {
        const methods = [
            // V4
            {
                // swap(address,(address,address,address,address,uint256,uint256,uint256,bytes),bytes)
                sigHash: '7c025200',
                offset: 260,
            },
            {
                // clipperSwapTo(address,address,address,uint256,uint256)
                sigHash: '9994dd15',
                offset: 132,
            },
            {
                // fillOrderRFQTo((uint256,address,address,address,address,uint256,uint256),bytes,uint256,uint256,address)
                sigHash: 'baba5855',
                offset: 292,
            },
            {
                // uniswapV3SwapTo(address,uint256,uint256,uint256[])
                sigHash: 'bc80f1a8',
                offset: 68,
            },

            // V5
            {
                // clipperSwapTo(address,address,address,address,uint256,uint256,uint256,bytes32,bytes32)
                sigHash: '093d4fa5',
                offset: 164, // +
            },
            {
                // swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
                sigHash: '12aa3caf',
                offset: 196, // +/-
            },
            {
                // fillOrderRFQTo((uint256,address,address,address,address,uint256,uint256),bytes,uint256,address)
                sigHash: '5a099843',
                offset: 196,
            },
            {
                // unoswapTo(address,address,uint256,uint256,uint256[])
                sigHash: 'f78dc253',
                offset: 100,
            },
            {
                // uniswapV3SwapTo(address,uint256,uint256,uint256[])
                sigHash: 'bc80f1a8',
                offset: 68,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        if (!method) {
            throw new Error(`Cannot get offset for 1inch calldata. sigHash: ${sigHash}`)
        }

        return method.offset
    }
}

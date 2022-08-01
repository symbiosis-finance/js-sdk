import { BigNumber } from 'ethers'
import JSBI from 'jsbi'
import { formatUnits } from '@ethersproject/units'
import fetch from 'node-fetch-native'

import { Percent, Token, TokenAmount, wrappedToken } from '../entities'
import { OneInchOracle } from './contracts'
import { getMulticall } from './multicall'
import { BIPS_BASE } from './constants'
import { ChainId } from '../constants'
import { DataProvider } from './dataProvider'

const API_URL = 'https://api.1inch.io/v4.0'

type Protocol = {
    id: string
    title: string
    img: string
    img_color: string
}

export class OneInchTrade {
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

    public constructor(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        slippage: number,
        oracle: OneInchOracle,
        dataProvider: DataProvider
    ) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.from = from
        this.to = to
        this.slippage = slippage
        this.oracle = oracle
        this.dataProvider = dataProvider
    }

    public async init() {
        const nativeAddress = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = nativeAddress
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = nativeAddress
        }

        const protocols = await this.dataProvider.getOneInchProtocols(this.tokenAmountIn.token.chainId)

        const params = []
        params.push(`fromTokenAddress=${fromTokenAddress}`)
        params.push(`toTokenAddress=${toTokenAddress}`)
        params.push(`amount=${this.tokenAmountIn.raw.toString()}`)
        params.push(`fromAddress=${this.from}`)
        params.push(`destReceiver=${this.to}`)
        params.push(`slippage=${this.slippage}`)
        params.push(`disableEstimate=true`)
        params.push(`allowPartialFill=false`)
        params.push(`usePatching=true`)
        params.push(`protocols=${protocols.map((i) => i.id).join(',')}`)

        const url = `${API_URL}/${this.tokenAmountIn.token.chainId}/swap?${params.join('&')}`

        const response = await fetch(url)
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
        this.priceImpact = await this.calculatePriceImpact(this.tokenAmountIn, this.amountOut)

        return this
    }

    static async getProtocols(chainId: ChainId): Promise<Protocol[]> {
        const url = `${API_URL}/${chainId}/liquidity-sources`
        const response = await fetch(url)
        const json = await response.json()
        if (response.status === 400) {
            throw new Error(`Cannot get 1inch protocols: ${json['description']}`)
        }
        return json['protocols'].reduce((acc: Protocol[], protocol: Protocol) => {
            if (protocol.id.includes('ONE_INCH_LIMIT_ORDER')) {
                return acc
            }
            if (protocol.id.includes('PMM')) {
                return acc
            }
            acc.push(protocol)
            return acc
        }, [])
    }

    private getOffset(callData: string) {
        const methods = [
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
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        return method?.offset
    }

    static async getRateToEth(tokens: Token[], oracle: OneInchOracle) {
        const calls = tokens.map((token) => ({
            target: oracle.address,
            callData: oracle.interface.encodeFunctionData(
                'getRateToEth',
                [token.address, true] // use wrapper
            ),
        }))
        const multicall = await getMulticall(oracle.provider)
        return await multicall.callStatic.tryAggregate(false, calls)
    }

    private async calculatePriceImpact(tokenAmountIn: TokenAmount, tokenAmountOut: TokenAmount): Promise<Percent> {
        const tokens = [wrappedToken(tokenAmountIn.token), wrappedToken(tokenAmountOut.token)]

        const aggregated = await this.dataProvider.getOneInchRateToEth(tokens, this.oracle)

        const denominator = BigNumber.from(10).pow(18) // eth decimals

        const data = aggregated.map(([success, returnData], i): BigNumber | undefined => {
            if (!success || returnData === '0x') return
            const result = this.oracle.interface.decodeFunctionResult('getRateToEth', returnData)

            const numerator = BigNumber.from(10).pow(tokens[i].decimals)

            return BigNumber.from(result.weightedRate).mul(numerator).div(denominator)
        })

        if (!data[0] || !data[1]) {
            throw new Error('OneInch oracle: cannot to receive rate to ETH')
        }
        const multiplierPow = 18
        const multiplier = BigNumber.from(10).pow(multiplierPow)

        const spot = data[0].mul(multiplier).div(data[1]) // with e18

        // calc real rate
        const inBn = BigNumber.from(tokenAmountIn.raw.toString()).mul(
            BigNumber.from(10).pow(tokenAmountOut.token.decimals)
        )
        const outBn = BigNumber.from(tokenAmountOut.raw.toString()).mul(
            BigNumber.from(10).pow(tokenAmountIn.token.decimals)
        )
        const real = outBn.mul(multiplier).div(inBn)

        const impact = real.mul(multiplier).div(spot)
        const impactNumber = 1 - Number.parseFloat(formatUnits(impact, multiplierPow))

        return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
    }
}

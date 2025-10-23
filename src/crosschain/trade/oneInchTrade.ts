import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Percent, TokenAmount, wrappedToken } from '../../entities'
import { OneInchOracle__factory } from '../contracts'
import { Symbiosis } from '../symbiosis'
import { getMinAmount } from '../chainUtils'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getMulticall } from '../multicall'
import { BigNumber } from '@ethersproject/bignumber'
import { formatUnits } from '@ethersproject/units'
import JSBI from 'jsbi'
import { BIPS_BASE } from '../constants'
import { OneInchTradeError } from '../sdkError'

export type OneInchProtocols = string[]

interface GetTradePriceImpactParams {
    tokenAmountIn: TokenAmount
    tokenAmountOut: TokenAmount
}

interface Protocol {
    id: string
    title: string
    img: string
    img_color: string
}

interface OneInchError {
    error: string
    description: string
    statusCode: 400 | 500
    requestId: string
    meta: { type: string; value: string }[]
}

interface OneInchTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    from: string
    protocols?: OneInchProtocols
}

const ONE_INCH_CHAINS: ChainId[] = [
    ChainId.ETH_MAINNET,
    ChainId.BSC_MAINNET,
    ChainId.MATIC_MAINNET,
    ChainId.OPTIMISM_MAINNET,
    ChainId.ARBITRUM_MAINNET,
    ChainId.AVAX_MAINNET,
    ChainId.ZKSYNC_MAINNET,
    ChainId.BASE_MAINNET,
    ChainId.GNOSIS_MAINNET,
]

const ONE_INCH_ORACLE_MAP: { [chainId in ChainId]?: string } = {
    [ChainId.ETH_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.BSC_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.MATIC_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.OPTIMISM_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.ARBITRUM_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.AVAX_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.ZKSYNC_MAINNET]: '0x739B4e7a3ad8210B6315F75b24cfe0D3226f6945',
    [ChainId.BASE_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
    [ChainId.GNOSIS_MAINNET]: '0x00000000000D6FFc74A8feb35aF5827bf57f6786',
}

export class OneInchTrade extends SymbiosisTrade {
    private readonly symbiosis: Symbiosis
    private readonly from: string
    private readonly protocols: OneInchProtocols

    static isAvailable(chainId: ChainId): boolean {
        return ONE_INCH_CHAINS.includes(chainId)
    }

    public constructor(params: OneInchTradeParams) {
        super(params)

        const { symbiosis, from, protocols } = params
        this.symbiosis = symbiosis
        this.from = from
        this.protocols = protocols || []
    }

    get tradeType(): SymbiosisTradeType {
        return '1inch'
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

        const protocolsOrigin = await OneInchTrade.getProtocols(this.symbiosis, this.tokenAmountIn.token.chainId)
        let protocols = this.protocols.filter((x) => protocolsOrigin.includes(x))
        if (protocols.length === 0) {
            protocols = protocolsOrigin
        }

        const searchParams = new URLSearchParams()

        searchParams.set('src', fromTokenAddress)
        searchParams.set('dst', toTokenAddress)
        searchParams.set('amount', this.tokenAmountIn.raw.toString())
        searchParams.set('from', this.from)
        searchParams.set('slippage', (this.slippage / 100).toFixed(4))
        searchParams.set('receiver', this.to)
        searchParams.set('disableEstimate', 'true')
        searchParams.set('allowPartialFill', 'false')
        searchParams.set('usePatching', 'true')
        searchParams.set('protocols', protocols.join(','))

        let json: any
        try {
            json = await OneInchTrade.request(this.symbiosis, `${this.tokenAmountIn.token.chainId}/swap`, searchParams)
        } catch (error) {
            let errorText = 'Unknown error'

            if (error instanceof Error) {
                try {
                    const parsed = JSON.parse(error.message ?? '') as OneInchError
                    errorText = `Message: ${parsed.description}`
                } catch {
                    errorText = error?.message ?? 'Unknown error'
                }
            }

            throw new OneInchTradeError(`Cannot get swap on chain ${this.tokenAmountIn.token.chainId}: ${errorText}`)
        }

        const tx: {
            from: string
            to: string
            data: string
            value: string
            gas: string
            gasPrice: string
        } = json['tx']
        const callData = tx.data
        const { amountOffset, minReceivedOffset } = this.getOffsets(callData)

        const amountOutRaw: string = json['toAmount']
        const amountOut = new TokenAmount(this.tokenOut, amountOutRaw)

        const amountOutMinRaw = getMinAmount(this.slippage, amountOutRaw)
        const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        const priceImpact = await this.getTradePriceImpact({
            tokenAmountIn: this.tokenAmountIn,
            tokenAmountOut: amountOut,
        })

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            routerAddress: tx.to,
            callData,
            callDataOffset: amountOffset,
            minReceivedOffset,
            priceImpact,
        }
        return this
    }

    private static async request(symbiosis: Symbiosis, method: string, urlParams?: URLSearchParams) {
        const requestUrl = new URL(method, symbiosis.oneInchConfig.apiUrl)

        if (urlParams) {
            requestUrl.search = urlParams.toString()
        }

        const apiKeys = symbiosis.oneInchConfig.apiKeys
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]
        const response = await fetch(requestUrl.toString(), {
            headers: { Authorization: `Bearer ${apiKey}` },
        })

        if (!response.ok) {
            const text = await response.text()

            throw new OneInchTradeError(text)
        }

        return response.json()
    }

    static async getProtocols(symbiosis: Symbiosis, chainId: ChainId): Promise<OneInchProtocols> {
        try {
            const json = await symbiosis.cache.get(
                ['oneInchGetProtocols', chainId.toString()],
                async () => {
                    return OneInchTrade.request(symbiosis, `${chainId}/liquidity-sources`)
                },
                4 * 60 * 60 // 4h
            )

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
        } catch (error) {
            throw new OneInchTradeError(`Cannot get swap on chain ${chainId}`, error)
        }
    }

    private getOffsets(callData: string) {
        const methods = [
            // V4
            {
                // swap(address,(address,address,address,address,uint256,uint256,uint256,bytes),bytes)
                sigHash: '7c025200',
                offset: 260,
                minReceivedOffset: 292,
            },
            {
                // clipperSwapTo(address,address,address,uint256,uint256)
                sigHash: '9994dd15',
                offset: 132,
                minReceivedOffset: 164,
            },
            {
                // fillOrderRFQTo((uint256,address,address,address,address,uint256,uint256),bytes,uint256,uint256,address)
                sigHash: 'baba5855',
                offset: 292,
                minReceivedOffset: 324,
            },
            {
                // uniswapV3SwapTo(address,uint256,uint256,uint256[])
                sigHash: 'bc80f1a8',
                offset: 68,
                minReceivedOffset: 100,
            },

            // V5
            {
                // clipperSwapTo(address,address,address,address,uint256,uint256,uint256,bytes32,bytes32)
                sigHash: '093d4fa5',
                offset: 164, // +
                minReceivedOffset: 196,
            },
            {
                // clipperSwap(address,address,address,address,uint256,uint256,uint256,bytes32,bytes32)
                sigHash: '84bd6d29',
                offset: 132, // +
                minReceivedOffset: 164,
            },
            {
                // swap(address,(address,address,address,address,uint256,uint256,uint256),bytes,bytes)
                sigHash: '12aa3caf',
                offset: 196, // +/-
                minReceivedOffset: 228,
            },
            {
                // fillOrderRFQTo((uint256,address,address,address,address,uint256,uint256),bytes,uint256,address)
                sigHash: '5a099843',
                offset: 196,
                minReceivedOffset: 228,
            },
            {
                // unoswapTo(address,address,uint256,uint256,uint256[])
                sigHash: 'f78dc253',
                offset: 100,
                minReceivedOffset: 132,
            },
            {
                // unoswap(address,uint256,uint256,uint256[])
                sigHash: '0502b1c5',
                offset: 68,
                minReceivedOffset: 100,
            },
            {
                // uniswapV3SwapTo(address,uint256,uint256,uint256[])
                sigHash: 'bc80f1a8',
                offset: 68,
                minReceivedOffset: 100,
            },
            {
                // uniswapV3Swap(uint256,uint256,uint256[])
                sigHash: 'e449022e',
                offset: 36,
                minReceivedOffset: 68,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        if (method === undefined) {
            throw new OneInchTradeError('Unknown swap method encoded to calldata')
        }
        return {
            amountOffset: method.offset,
            minReceivedOffset: method.minReceivedOffset,
        }
    }

    private async getTradePriceImpact({ tokenAmountIn, tokenAmountOut }: GetTradePriceImpactParams): Promise<Percent> {
        const chainId = tokenAmountIn.token.chainId
        const provider = this.symbiosis.getProvider(chainId)
        const oracleAddress = ONE_INCH_ORACLE_MAP[chainId]
        if (!oracleAddress) {
            throw new OneInchTradeError(`Could not find off-chain oracle on chain ${chainId}`)
        }
        const oracleInterface = OneInchOracle__factory.createInterface()

        const tokens = [wrappedToken(tokenAmountIn.token), wrappedToken(tokenAmountOut.token)]

        const aggregated = await this.symbiosis.cache.get(
            ['getOneInchRateToEth', chainId.toString(), ...tokens.map((i) => i.address)],
            async () => {
                const calls = tokens.map((token) => ({
                    target: oracleAddress,
                    callData: oracleInterface.encodeFunctionData(
                        'getRateToEth',
                        [token.address, true] // use wrapper
                    ),
                }))

                const multicall = await getMulticall(provider)
                return multicall.callStatic.tryAggregate(true, calls)
            },
            10 * 60 // 10 minutes
        )

        const denominator = BigNumber.from(10).pow(18) // eth decimals

        const data = aggregated.map(([success, returnData], i): BigNumber | undefined => {
            if (!success || returnData === '0x') {
                return
            }
            const result = oracleInterface.decodeFunctionResult('getRateToEth', returnData)

            const numerator = BigNumber.from(10).pow(tokens[i].decimals)

            return BigNumber.from(result.weightedRate).mul(numerator).div(denominator)
        })

        if (!data[0] || !data[1]) {
            throw new OneInchTradeError('Cannot get rate to ETH from price oracle')
        }
        if (data[0].isZero() || data[1]?.isZero()) {
            return new Percent('0', BIPS_BASE)
        }
        const multiplierPow = 18
        const multiplier = BigNumber.from(10).pow(multiplierPow)

        const spot = data[1].mul(multiplier).div(data[0]) // with e18

        // calc real rate
        const inBn = BigNumber.from(tokenAmountIn.raw.toString()).mul(
            BigNumber.from(10).pow(tokenAmountOut.token.decimals)
        )
        const outBn = BigNumber.from(tokenAmountOut.raw.toString()).mul(
            BigNumber.from(10).pow(tokenAmountIn.token.decimals)
        )
        const real = inBn.mul(multiplier).div(outBn)

        const impact = real.mul(multiplier).div(spot)
        const impactNumber = 1 - Number.parseFloat(formatUnits(impact, multiplierPow))

        return new Percent(parseInt(`${impactNumber * JSBI.toNumber(BIPS_BASE)}`).toString(), BIPS_BASE)
    }
}

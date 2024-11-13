import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Percent, Token, TokenAmount } from '../../entities'
import { SymbiosisTrade } from './symbiosisTrade'
import { getMinAmount } from '../chainUtils'
import type { Symbiosis } from '../symbiosis'
import { BIPS_BASE } from '../constants'
import BigNumber from 'bignumber.js'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

interface OpenOceanTradeParams {
    symbiosis: Symbiosis
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
    slippage: number
}

interface OpenOceanQuote {
    to: string
    inAmount: string
    outAmount: string
    data: string
    price_impact: string
}

interface OpenOceanChain {
    slug: string
    nativeTokenAddress: string
}

const OPEN_OCEAN_NETWORKS: Partial<Record<ChainId, OpenOceanChain>> = {
    // ---  1inch supported chains
    [ChainId.ETH_MAINNET]: {
        slug: 'eth',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.BSC_MAINNET]: {
        slug: 'bsc',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.ZKSYNC_MAINNET]: {
        slug: 'zksync',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.MATIC_MAINNET]: {
        slug: 'polygon',
        nativeTokenAddress: '0x0000000000000000000000000000000000001010',
    },
    [ChainId.BASE_MAINNET]: {
        slug: 'base',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.AVAX_MAINNET]: {
        slug: 'avax',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.ARBITRUM_MAINNET]: {
        slug: 'arbitrum',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.OPTIMISM_MAINNET]: {
        slug: 'optimism',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    // --- OpenOcean supported only chains
    [ChainId.KAVA_MAINNET]: {
        slug: 'kava',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.POLYGON_ZK]: {
        slug: 'polygon_zkevm',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.LINEA_MAINNET]: {
        slug: 'linea',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.SCROLL_MAINNET]: {
        slug: 'scroll',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.MANTLE_MAINNET]: {
        slug: 'mantle',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.MANTA_MAINNET]: {
        slug: 'manta',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.METIS_MAINNET]: {
        slug: 'metis',
        nativeTokenAddress: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000',
    },
    [ChainId.BLAST_MAINNET]: {
        slug: 'blast',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.MODE_MAINNET]: {
        slug: 'mode',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.RSK_MAINNET]: {
        slug: 'rootstock',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.CRONOS_MAINNET]: {
        slug: 'cronos',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.SEI_EVM_MAINNET]: {
        slug: 'sei',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.TELOS_MAINNET]: {
        slug: 'telos',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.GRAVITY_MAINNET]: {
        slug: 'gravity',
        nativeTokenAddress: AddressZero,
    },
}

const BASE_URL = 'https://open-api.openocean.finance/v3'

export class OpenOceanTrade implements SymbiosisTrade {
    public tradeType = 'open-ocean' as const

    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public callDataOffset?: number
    public priceImpact!: Percent
    public routerAddress!: string

    private chain?: OpenOceanChain
    private endpoint: string

    private readonly symbiosis: Symbiosis
    private readonly tokenOut: Token
    private readonly to: string
    private readonly slippage: number

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(OPEN_OCEAN_NETWORKS).includes(chainId.toString())
    }

    public constructor({ symbiosis, tokenAmountIn, tokenOut, to, slippage }: OpenOceanTradeParams) {
        this.symbiosis = symbiosis

        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
        this.to = to
        this.slippage = slippage
        this.endpoint = BASE_URL
    }

    public async init() {
        this.chain = OPEN_OCEAN_NETWORKS[this.tokenAmountIn.token.chainId]
        if (!this.chain) {
            throw new Error('Unsupported chain')
        }
        this.endpoint = `${BASE_URL}/${this.chain.slug}`

        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = this.chain.nativeTokenAddress
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = this.chain.nativeTokenAddress
        }

        const url = new URL(`${this.endpoint}/swap_quote`)
        url.searchParams.set('inTokenAddress', fromTokenAddress)
        url.searchParams.set('outTokenAddress', toTokenAddress)
        url.searchParams.set('amount', this.tokenAmountIn.toFixed())
        url.searchParams.set('gasPrice', '5')
        url.searchParams.set('slippage', (this.slippage / 100).toString())
        url.searchParams.set('account', this.to)
        url.searchParams.set('referrer', '0x3254aE00947e44B7fD03F50b93B9acFEd59F9620')

        const response = await this.symbiosis.fetch(url.toString())

        if (!response.ok) {
            const text = await response.text()
            throw new Error(`Cannot build OpenOcean trade for chain ${this.tokenAmountIn.token.chainId}: ${text}`)
        }
        const json = await response.json()

        if (json.code !== 200) {
            throw new Error(
                `Cannot build OpenOcean trade for chain ${this.tokenAmountIn.token.chainId}: ${JSON.stringify(json)}}`
            )
        }

        const { data, outAmount, to, price_impact: priceImpactString } = json.data as OpenOceanQuote

        this.routerAddress = to
        this.callData = data
        this.callDataOffset = this.getOffset(data)

        this.amountOut = new TokenAmount(this.tokenOut, outAmount)

        const amountOutMinRaw = getMinAmount(this.slippage, outAmount)
        this.amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

        this.route = [this.tokenAmountIn.token, this.tokenOut]

        this.priceImpact = this.convertPriceImpact(priceImpactString)

        return this
    }
    public applyAmountIn(amount: TokenAmount) {
        // TODO implement me
        console.log(amount)
    }

    private getOffset(callData: string) {
        const methods = [
            {
                // swap
                sigHash: '90411a32',
                offset: 260,
            },
            {
                // uniswapV3SwapTo
                sigHash: 'bc80f1a8',
                offset: 68,
            },
            {
                // callUniswapTo
                sigHash: '6b58f2f0',
                offset: 68,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        if (method === undefined) {
            throw new Error('Unknown OpenOcean swap method encoded to calldata')
        }

        return method.offset
    }

    private convertPriceImpact(value?: string) {
        if (!value) {
            return new Percent('0')
        }

        const number = new BigNumber(value.split('%')[0])
        if (number.isNaN()) {
            return new Percent('0')
        }

        return new Percent(number.multipliedBy(100).integerValue().toString(), BIPS_BASE)
    }
}

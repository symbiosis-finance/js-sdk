import { ChainId, NATIVE_TOKEN_ADDRESS } from '../../constants'
import { Percent, TokenAmount } from '../../entities'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getMinAmount } from '../chainUtils'
import type { Symbiosis } from '../symbiosis'
import { BIPS_BASE } from '../constants'
import BigNumber from 'bignumber.js'
import { AddressZero } from '@ethersproject/constants/lib/addresses'
import { Address, NonEmptyAddress } from '..'
import { OpenOceanTradeError } from '../sdkError'

interface OpenOceanTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
}

export interface OpenOceanQuote {
    to: Address
    inAmount: string
    outAmount: string
    data: string
    price_impact: string
}

interface OpenOceanChain {
    slug: string
    nativeTokenAddress: NonEmptyAddress
}

interface OpenOceanError {
    code: number
    errorMsg: string
    error?: string
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
    [ChainId.MATIC_MAINNET]: {
        slug: 'polygon',
        nativeTokenAddress: '0x0000000000000000000000000000000000001010',
    },
    [ChainId.OPTIMISM_MAINNET]: {
        slug: 'optimism',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.ARBITRUM_MAINNET]: {
        slug: 'arbitrum',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.AVAX_MAINNET]: {
        slug: 'avax',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.ZKSYNC_MAINNET]: {
        slug: 'zksync',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.BASE_MAINNET]: {
        slug: 'base',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.GNOSIS_MAINNET]: {
        slug: 'xdai',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.UNICHAIN_MAINNET]: {
        slug: 'uni',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.LINEA_MAINNET]: {
        slug: 'linea',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.SONIC_MAINNET]: {
        slug: 'sonic',
        nativeTokenAddress: AddressZero,
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
    [ChainId.BERACHAIN_MAINNET]: {
        slug: 'bera',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.OPBNB_MAINNET]: {
        slug: 'opbnb',
        nativeTokenAddress: NATIVE_TOKEN_ADDRESS,
    },
    [ChainId.APECHAIN_MAINNET]: {
        slug: 'ape',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.PLASMA_MAINNET]: {
        slug: 'plasma',
        nativeTokenAddress: AddressZero,
    },
    [ChainId.HYPERLIQUID_MAINNET]: {
        slug: 'hyperevm',
        nativeTokenAddress: AddressZero,
    },
}

export class OpenOceanTrade extends SymbiosisTrade {
    private readonly chain: OpenOceanChain
    private readonly endpoint: string
    private readonly symbiosis: Symbiosis

    static isAvailable(chainId: ChainId): boolean {
        return Object.keys(OPEN_OCEAN_NETWORKS).includes(chainId.toString())
    }

    public constructor(params: OpenOceanTradeParams) {
        super(params)

        const chainId = this.tokenAmountIn.token.chainId
        const chain = OPEN_OCEAN_NETWORKS[chainId]
        if (!chain) {
            throw new OpenOceanTradeError('Unsupported chain')
        }
        this.chain = chain
        this.symbiosis = params.symbiosis
        this.endpoint = `${params.symbiosis.openOceanConfig.apiUrl}/${chainId}`
    }

    get tradeType(): SymbiosisTradeType {
        return 'open-ocean'
    }

    public async init() {
        const response = await this.request()

        try {
            const { data, outAmount, to, price_impact: priceImpactString } = response
            const { amountOffset, minReceivedOffset } = this.getOffsets(data)

            const amountOut = new TokenAmount(this.tokenOut, outAmount)

            const amountOutMinRaw = getMinAmount(this.slippage, outAmount)
            const amountOutMin = new TokenAmount(this.tokenOut, amountOutMinRaw)

            this.out = {
                amountOut,
                amountOutMin,
                routerAddress: to,
                route: [this.tokenAmountIn.token, this.tokenOut],
                callData: data,
                callDataOffset: amountOffset,
                minReceivedOffset,
                priceImpact: this.convertPriceImpact(priceImpactString),
            }

            return this
        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new OpenOceanTradeError(e.message, response)
            }
            throw e
        }
    }

    public async request(): Promise<OpenOceanQuote> {
        let fromTokenAddress = this.tokenAmountIn.token.address
        if (this.tokenAmountIn.token.isNative) {
            fromTokenAddress = this.chain.nativeTokenAddress
        }

        let toTokenAddress = this.tokenOut.address
        if (this.tokenOut.isNative) {
            toTokenAddress = this.chain.nativeTokenAddress
        }

        const apiKeys = this.symbiosis.openOceanConfig.apiKeys
        const apiKey = apiKeys[Math.floor(Math.random() * apiKeys.length)]

        const gasPrice = await this.getGasPrice(apiKey)

        const url = new URL(`${this.endpoint}/swap`)
        url.searchParams.set('inTokenAddress', fromTokenAddress)
        url.searchParams.set('outTokenAddress', toTokenAddress)
        url.searchParams.set('amountDecimals', this.tokenAmountIn.raw.toString())
        url.searchParams.set('gasPriceDecimals', gasPrice.toString())
        url.searchParams.set('slippage', (this.slippage / 100).toString())
        url.searchParams.set('account', this.to)
        url.searchParams.set('referrer', '0x3254aE00947e44B7fD03F50b93B9acFEd59F9620')
        url.searchParams.set('disableRfq', 'true')

        const response = await this.symbiosis.fetch(url.toString(), {
            headers: {
                apikey: apiKey,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) {
            let errorText
            try {
                const jsonError = JSON.parse(await response.text())
                errorText = jsonError?.message ?? 'Unknown error'
            } catch (e) {
                errorText = await response.text()
            }
            throw new OpenOceanTradeError(
                `Cannot build trade for chain ${this.tokenAmountIn.token.chainId}: Message: ${errorText}`
            )
        }
        const json = await response.json()

        if (json.code !== 200) {
            const errorJson = json as OpenOceanError
            throw new OpenOceanTradeError(
                `Cannot build trade for chain ${this.tokenAmountIn.token.chainId}. Message: ${
                    errorJson?.error ?? errorJson.errorMsg
                }`
            )
        }

        return json.data as OpenOceanQuote
    }

    private getOffsets(callData: string) {
        const methods = [
            {
                // swap
                sigHash: '90411a32',
                amountOffset: 260,
                minReceivedOffset: 292,
            },
            {
                // uniswapV3SwapTo
                sigHash: 'bc80f1a8',
                amountOffset: 68,
                minReceivedOffset: 100,
            },
            {
                // callUniswapTo
                sigHash: '6b58f2f0',
                amountOffset: 68,
                minReceivedOffset: 100,
            },
        ]

        const sigHash = callData.slice(2, 10)

        const method = methods.find((i) => {
            return i.sigHash === sigHash
        })

        if (method === undefined) {
            throw new OpenOceanTradeError('Unknown swap method encoded to calldata')
        }

        return {
            amountOffset: method.amountOffset,
            minReceivedOffset: method.minReceivedOffset,
        }
    }

    private convertPriceImpact(value?: string) {
        const zeroPercent = new Percent('0', BIPS_BASE)
        if (!value) {
            return zeroPercent
        }

        const number = new BigNumber(value.split('%')[0])
        if (number.isNaN()) {
            return zeroPercent
        }
        if (!number.isFinite()) {
            return zeroPercent
        }

        return new Percent(number.multipliedBy(100).integerValue().toString(), BIPS_BASE)
    }

    private async getGasPrice(apiKey: string) {
        const isMainnet = this.tokenAmountIn.token.chainId === ChainId.ETH_MAINNET

        return this.symbiosis.cache.get(
            ['openOceanGasPrice', this.endpoint],
            async () => {
                const response = await fetch(`${this.endpoint}/gasPrice`, {
                    headers: {
                        apiKey,
                        'Content-Type': 'application/json',
                    },
                })
                if (!response.ok) {
                    throw new OpenOceanTradeError('Failed to get gas price')
                }
                const json = await response.json()

                if (isMainnet) {
                    return json.data.standard.legacyGasPrice as number
                }

                return json.data.standard as number
            },
            600 // 10 minutes
        )
    }
}

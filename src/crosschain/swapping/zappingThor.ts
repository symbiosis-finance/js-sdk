import { ChainId } from '../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { BaseSwapping } from './baseSwapping'
import { MulticallRouter, ThorRouter__factory } from '../contracts'
import fetch from 'isomorphic-unfetch'
import { OneInchProtocols } from '../trade/oneInchTrade'
import { AmountTooLowError, SdkError } from '../sdkError'
import { BigNumber } from 'ethers'
import { getMinAmount, isEvmChainId } from '../chainUtils'
import { AddressType, getAddressInfo, validate } from 'bitcoin-address-validation'
import { SwapExactInResult } from '../types'

export interface ZappingThorExactInParams {
    tokenAmountIn: TokenAmount
    thorTokenIn: Token
    from: string
    to: string
    slippage: number
    deadline: number
    partnerAddress?: string
    oneInchProtocols?: OneInchProtocols
}

type ThorQuote = {
    memo: string
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    router: string
    expiry: string
    fees: {
        asset: string
        total: string
    }
}

const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

const thorApiUrl = 'https://thornode.ninerealms.com'

type ThorPool = {
    asset: string
    status: 'Available' | 'Staged'
    pending_inbound_asset: string
    pending_inbound_rune: string
    balance_asset: string
    balance_rune: string
    pool_units: string
    LP_units: string
    synth_units: string
    synth_supply: string
    savers_depth: string
    savers_units: string
    synth_mint_paused: false
    synth_supply_remaining: string
    loan_collateral: string
    loan_cr: string
    derived_depth_bps: string
}

function toThorToken(token: Token): string {
    const chain = toThorChain(token.chainId)
    return `${chain}.${token.symbol}-${token.address.toUpperCase()}`
}

function toThorChain(chainId: ChainId): string {
    let chain
    if (chainId === ChainId.AVAX_MAINNET) {
        chain = 'AVAX'
    } else if (chainId === ChainId.ETH_MAINNET) {
        chain = 'ETH'
    } else if (chainId === ChainId.BSC_MAINNET) {
        chain = 'BSC'
    } else {
        throw new SdkError('toThorChain: unknown chain')
    }
    return chain
}

function toThorAmount(tokenAmount: TokenAmount): BigNumber {
    const tokenDecimals = BigNumber.from(10).pow(tokenAmount.token.decimals)
    const thorDecimals = BigNumber.from(10).pow(8)
    return BigNumber.from(tokenAmount.raw.toString()).mul(thorDecimals).div(tokenDecimals)
}

const MIN_AMOUNT_IN = 100

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: string

    protected thorTokenIn!: Token
    protected thorTokenOut = 'BTC.BTC'
    protected thorVault!: string
    protected thorQuote!: ThorQuote
    protected evmTo!: string

    protected async doPostTransitAction() {
        const amountIn = parseFloat(this.transit.amountIn.toSignificant())
        if (amountIn < MIN_AMOUNT_IN) {
            throw new AmountTooLowError(`The min swap amount towards Bitcoin is $${MIN_AMOUNT_IN}`)
        }
        this.thorQuote = await this.getThorQuote(this.transit.amountOut)
    }

    public async exactIn({
        tokenAmountIn,
        thorTokenIn,
        from,
        to,
        slippage,
        deadline,
        partnerAddress,
    }: ZappingThorExactInParams): Promise<SwapExactInResult> {
        const isAddressValid = validate(to)
        if (!isAddressValid) {
            throw new SdkError('Bitcoin address is not valid')
        }
        const addressInfo = getAddressInfo(to)
        if (addressInfo.type === AddressType.p2tr) {
            throw new SdkError(`ThorChain doesn't support taproot addresses`)
        }
        this.bitcoinAddress = to
        this.thorTokenIn = thorTokenIn

        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = this.symbiosis.config.refundAddress
        }

        // check if there is "Available" ThorChain pool at the moment
        await ZappingThor.getThorPools(thorTokenIn)

        this.multicallRouter = this.symbiosis.multicallRouter(thorTokenIn.chainId)
        this.thorVault = await ZappingThor.getThorVault(thorTokenIn)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(thorTokenIn.chainId, this.omniPoolConfig)
        if (transitTokenIn.equals(transitTokenOut)) {
            throw new SdkError('Same transit token')
        }

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: thorTokenIn,
            from,
            to: this.evmTo,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
            partnerAddress,
        })

        return {
            ...result,
            tokenAmountOut: this.thorQuote.amountOut,
            tokenAmountOutMin: this.thorQuote.amountOutMin,
            routes: [
                ...result.routes,
                {
                    provider: 'thorchain-bridge',
                    tokens: [thorTokenIn, BTC],
                },
            ],
            fees: [
                ...result.fees,
                {
                    provider: 'thorchain-bridge',
                    description: 'THORChain fee',
                    value: new TokenAmount(BTC, this.thorQuote.fees.total),
                },
            ],
        }
    }

    protected static async getThorPools(token: Token): Promise<ThorPool> {
        const url = new URL('/thorchain/pools', thorApiUrl)
        const response = await fetch(url.toString(), {
            headers: {
                'x-client-id': 'symbiosis',
            },
        })

        const json = (await response.json()) as ThorPool[]

        const found = json.find((i: ThorPool) => {
            return i.asset === toThorToken(token)
        })
        if (!found) {
            throw new SdkError('Thor pool not found')
        }
        if (found.status !== 'Available') {
            throw new SdkError('Thor pool is not available')
        }
        return found
    }

    protected static async getThorVault(token: Token): Promise<string> {
        const url = new URL('/thorchain/inbound_addresses', thorApiUrl)
        const response = await fetch(url.toString(), {
            headers: {
                'x-client-id': 'symbiosis',
            },
        })

        const json = await response.json()

        if (json.error) {
            throw new SdkError(json.error)
        }

        const found = json.find((i: any) => {
            return i.chain === toThorChain(token.chainId)
        })
        if (!found) {
            throw new SdkError('Thor vault not found')
        }
        return found.address
    }

    protected async getThorQuote(amount: TokenAmount): Promise<ThorQuote> {
        const url = new URL('/thorchain/quote/swap', thorApiUrl)

        url.searchParams.set('from_asset', toThorToken(this.thorTokenIn))
        url.searchParams.set('to_asset', this.thorTokenOut)
        url.searchParams.set('refund_address', this.evmTo)
        url.searchParams.set('amount', toThorAmount(amount).toString())
        url.searchParams.set('destination', this.bitcoinAddress)
        url.searchParams.set('streaming_interval', '1')
        url.searchParams.set('streaming_quantity', '0')
        url.searchParams.set('affiliate', 'sy')
        url.searchParams.set('affiliate_bps', '20')

        const response = await fetch(url.toString(), {
            headers: {
                'x-client-id': 'symbiosis',
            },
        })

        const json = await response.json()

        if (json.error) {
            throw new SdkError(json.error)
        }
        const { memo, expected_amount_out: expectedAmountOut, router, expiry, fees } = json

        const defaultSlippage = 300 // 3%
        const expectedAmountOutWithSlippage = getMinAmount(defaultSlippage, expectedAmountOut)
        const patchedMemo = memo.replace('0/1/0', `${expectedAmountOutWithSlippage.toString()}/1/0`)

        return {
            memo: patchedMemo,
            amountOut: new TokenAmount(BTC, expectedAmountOut),
            amountOutMin: new TokenAmount(BTC, expectedAmountOutWithSlippage),
            router,
            expiry,
            fees,
        }
    }

    protected tradeCTo(): string {
        return this.multicallRouter.address
    }

    protected finalReceiveSide(): string {
        return this.multicallRouter.address
    }

    protected finalCalldata(): string | [] {
        return this.buildMulticall()
    }

    protected finalOffset(): number {
        return 36
    }

    private buildMulticall() {
        const callDatas = []
        const receiveSides = []
        const path = []
        const offsets = []
        const amount = this.transit.amountOut

        if (this.tradeC) {
            callDatas.push(this.tradeC.callData)
            receiveSides.push(this.tradeC.routerAddress)
            path.push(this.tradeC.tokenAmountIn.token.address)
            offsets.push(this.tradeC.callDataOffset!)
        }

        const expiry = Math.floor(Date.now() / 1000) + 60 * 60 // + 1h
        const burnCalldata = ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
            this.thorVault,
            this.thorTokenIn.address,
            '0', // will be patched
            this.thorQuote.memo,
            expiry,
        ])

        callDatas.push(burnCalldata)
        receiveSides.push(this.thorQuote.router)
        path.push(this.thorTokenIn.address)
        offsets.push(100)

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.evmTo,
        ])
    }
}

import { ChainId } from '../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../entities'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { MulticallRouter, ThorRouter__factory } from './contracts'
import fetch from 'isomorphic-unfetch'
import { OneInchProtocols } from './trade/oneInchTrade'
import { Error } from './error'
import { BigNumber } from 'ethers'

export interface ZappingThorExactInParams {
    tokenAmountIn: TokenAmount
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}

type ThorQuote = {
    memo: string
    amountOut: TokenAmount
    router: string
    expiry: string
}

const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

const ETH_USDC = new Token({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})
const AVAX_USDC = new Token({
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    chainId: ChainId.AVAX_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

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
    let chain
    if (token.chainId === ChainId.AVAX_MAINNET) {
        chain = 'AVAX'
    } else if (token.chainId === ChainId.ETH_MAINNET) {
        chain = 'ETH'
    } else if (token.chainId === ChainId.BSC_MAINNET) {
        chain = 'BSC'
    } else {
        throw new Error('toThorToken: unknown chain')
    }
    return `${chain}.${token.symbol}-${token.address.toUpperCase()}`
}

function toThorAmount(tokenAmount: TokenAmount): BigNumber {
    const tokenDecimals = BigNumber.from(10).pow(tokenAmount.token.decimals)
    const thorDecimals = BigNumber.from(10).pow(8)
    return BigNumber.from(tokenAmount.raw.toString()).mul(thorDecimals).div(tokenDecimals)
}

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: string

    protected thorTokenIn!: Token
    protected thorTokenOut = 'BTC.BTC'
    protected thorVault!: string
    protected thorQuote!: ThorQuote

    protected async doPostTransitAction() {
        const amount = this.getTradeCAmountIn()
        this.thorQuote = await this.getThorQuote(amount)
    }

    public async exactIn({
        tokenAmountIn,
        from,
        to,
        slippage,
        deadline,
    }: ZappingThorExactInParams): Promise<CrosschainSwapExactInResult> {
        this.thorTokenIn = ETH_USDC
        if (tokenAmountIn.token.chainId === ChainId.ETH_MAINNET) {
            this.thorTokenIn = AVAX_USDC
        }

        // this.thorTokenIn = AVAX_USDC
        // if (tokenAmountIn.token.chainId === ChainId.AVAX_MAINNET) {
        //     this.thorTokenIn = ETH_USDC
        // }
        await this.getThorPools(this.thorTokenIn)

        this.multicallRouter = this.symbiosis.multicallRouter(this.thorTokenIn.chainId)
        this.bitcoinAddress = to

        this.thorVault = await this.getThorVault()

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: this.thorTokenIn,
            from,
            to: from,
            slippage,
            deadline,
        })

        // >> for display route purposes only
        result.route.push(new Token({ ...this.thorTokenIn, chainId: ChainId.BTC_MAINNET }))
        result.route.push(BTC)
        // << for display route purposes only

        return {
            ...result,
            tokenAmountOut: this.thorQuote.amountOut,
            outTradeType: 'thor-chain',
        }
    }

    protected async getThorPools(token: Token): Promise<ThorPool> {
        const url = new URL('/thorchain/pools', thorApiUrl)
        const response = await fetch(url.toString())

        const json = (await response.json()) as ThorPool[]

        const found = json.find((i: ThorPool) => {
            return i.asset === toThorToken(token)
        })
        if (!found) {
            throw new Error('Thor pool not found')
        }
        if (found.status !== 'Available') {
            throw new Error('Thor pool is not available')
        }
        return found
    }

    protected async getThorVault(): Promise<string> {
        const url = new URL('/thorchain/inbound_addresses', thorApiUrl)
        const response = await fetch(url.toString())

        const json = await response.json()

        if (json.error) {
            throw new Error(json.error)
        }

        const found = json.find((i: any) => {
            return i.chain === 'ETH'
        })
        if (!found) {
            throw new Error('Thor vault not found')
        }
        return found.address
    }

    protected async getThorQuote(amount: TokenAmount): Promise<ThorQuote> {
        const url = new URL('/thorchain/quote/swap', thorApiUrl)

        url.searchParams.set('from_asset', toThorToken(this.thorTokenIn))
        url.searchParams.set('to_asset', this.thorTokenOut)
        url.searchParams.set('refund_address', this.from)
        url.searchParams.set('amount', toThorAmount(amount).toString())
        url.searchParams.set('destination', this.bitcoinAddress)
        // url.searchParams.set('tolerance_bps', '300') // 3% FIXME

        const response = await fetch(url.toString())

        const json = await response.json()

        if (json.error) {
            throw new Error(json.error)
        }
        const { memo, expected_amount_out, router, expiry } = json

        return {
            memo,
            amountOut: new TokenAmount(BTC, expected_amount_out),
            router,
            expiry,
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
        const amount = this.getTradeCAmountIn()

        if (this.tradeC) {
            console.log('TRADE_C!', this.transit.amountOut.raw.toString(), amount.raw.toString())
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
            this.from,
        ])
    }
}

import { ChainId } from '../constants'
import {GAS_TOKEN, Token, TokenAmount} from '../entities'
import {BaseSwapping, CrosschainSwapExactInResult, SwapExactInParams} from './baseSwapping'
import {MulticallRouter, ThorRouter__factory} from './contracts'
import fetch from 'isomorphic-unfetch'

type ThorQuote = {
    memo: string
    amountOut: TokenAmount
    router: string
    expiry: string
}

// const USDC = new Token({
//     address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
//     chainId: ChainId.ETH_MAINNET,
//     decimals: 8,
//     name: 'USDC',
//     symbol: 'USDC',
//     icons: {
//         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
//         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
//     },
// })
const USDC = new Token({
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

function toThorToken(token: Token): string {
    let chain
    if (token.chainId === ChainId.AVAX_MAINNET) {
        chain = 'AVAX'
    } else if (token.chainId === ChainId.ETH_MAINNET) {
        chain = 'ETH'
    } else {
        throw new Error('toThorToken: unknown chain')
    }
    return `${chain}.${token.symbol}-${token.address.toUpperCase()}`
}

function toThorAmount(tokenAmount: TokenAmount): string {
    return (parseInt(tokenAmount.toSignificant(8)) * 1e8).toString()
}

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: string

    protected thorTokenIn = toThorToken(USDC)
    protected thorTokenOut = 'BTC.BTC'
    protected thorVault!: string
    protected thorQuote!: ThorQuote

    protected async doPostTransitAction() {
        const amount = toThorAmount(this.transit.amountOut)
        this.thorQuote = await this.getThorQuote(amount)
        console.log('this.thorQuote', this.thorQuote)
    }

    public async exactIn({ tokenAmountIn, from, to, slippage, deadline }: SwapExactInParams): Promise<CrosschainSwapExactInResult> {
        this.multicallRouter = this.symbiosis.multicallRouter(USDC.chainId)
        this.bitcoinAddress = to

        this.thorVault = await this.getThorVault()

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: USDC,
            from,
            to: from,
            slippage,
            deadline,
        })

        return {
            ...result,
            tokenAmountOut: this.thorQuote.amountOut,
        }
    }

    protected async getThorVault(): Promise<string> {
        const apiUrl = 'https://thornode.ninerealms.com'
        const url = new URL('/thorchain/inbound_addresses', apiUrl)
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

    protected async getThorQuote(amount: string): Promise<ThorQuote> {
        const apiUrl = 'https://thornode.ninerealms.com'
        const url = new URL('/thorchain/quote/swap', apiUrl)

        url.searchParams.set('from_asset', this.thorTokenIn)
        url.searchParams.set('to_asset', this.thorTokenOut)
        url.searchParams.set('refund_address', this.from)
        url.searchParams.set('amount', amount)
        url.searchParams.set('destination', this.bitcoinAddress)
        url.searchParams.set('tolerance_bps', '300') // 3%

        const response = await fetch(url.toString())

        const json = await response.json()

        if (json.error) {
            throw new Error(json.error)
        }
        const { memo, expected_amount_out, router, expiry } = json

        return {
            memo,
            amountOut: new TokenAmount(GAS_TOKEN[ChainId.BTC_MAINNET], expected_amount_out),
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
        const burnCalldata = ThorRouter__factory.createInterface()
            .encodeFunctionData('depositWithExpiry', [
                this.thorVault,
                USDC.address,
                toThorAmount(this.transit.amountOut),
                this.thorQuote.memo,
                this.thorQuote.expiry,
            ])

        const callDatas = [burnCalldata]
        const receiveSides = [this.thorQuote.router]
        const path = [USDC.address]
        const offsets = [100]

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.transit.amountOut.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.from,
        ])
    }
}

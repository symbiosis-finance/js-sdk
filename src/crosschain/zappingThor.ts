import { Signer } from 'ethers'
import { ChainId } from '../constants'
import { Token, TokenAmount } from '../entities'
import { BaseSwapping, SwapExactIn } from './baseSwapping'
import { MulticallRouter } from './contracts'
import fetch from 'isomorphic-unfetch'

export type ZappingThorExactIn = Promise<
    Omit<Awaited<SwapExactIn>, 'execute'> & {
        execute: ReturnType<ZappingThor['buildExecute']>
    }
>

type ThorQuote = {
    memo: string
    amountOut: TokenAmount
    router: string
    expiry: string
}

const BTC = new Token({
    chainId: ChainId.BTC_MAINNET,
    symbol: 'BTC',
    name: 'Bitcoin',
    address: '',
    decimals: 8,
    isNative: true,
    icons: {
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png',
    },
})

const USDC = new Token({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 8,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

function toThorAmount(tokenAmount: TokenAmount): string {
    return (parseInt(tokenAmount.toSignificant(8)) * 1e8).toString()
}

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: string

    protected thorTokenIn = `ETH.USDC-${USDC.address.toUpperCase()}`
    protected thorTokenOut = 'BTC.BTC'
    protected thorVault!: string
    protected thorQuote!: ThorQuote

    protected async doPostTransitAction() {
        const amount = toThorAmount(this.transit.amountOut)
        this.thorQuote = await this.getThorQuote(amount)
    }

    public async exactIn(
        tokenAmountIn: TokenAmount,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): ZappingThorExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(USDC.chainId)
        this.bitcoinAddress = to

        this.thorVault = await this.getThorVault()

        const { execute, ...result } = await this.doExactIn(
            tokenAmountIn,
            USDC,
            from,
            from,
            revertableAddress,
            slippage,
            deadline,
            use1Inch
        )

        return {
            ...result,
            execute: this.buildExecute(execute),
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
        url.searchParams.set('amount', amount)
        url.searchParams.set('destination', this.bitcoinAddress)
        url.searchParams.set('tolerance_bps', '500') // 5%

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

    public async waitForThor(transactionHash: string): Promise<string | undefined> {
        return new Promise<string | undefined>((resolve, reject) => {
            try {
                resolve(transactionHash) // FIXME correct BTC hash
            } catch (e) {
                reject(e)
            }
        })
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
        const burnCalldata = this.symbiosis
            .thorRouter()
            .interface.encodeFunctionData('depositWithExpiry', [
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

    private buildExecute(execute: Awaited<SwapExactIn>['execute']) {
        return async (signer: Signer) => {
            const { response, waitForMined } = await execute(signer)

            return {
                response,
                waitForMined: async () => {
                    const { receipt } = await waitForMined()

                    return {
                        receipt,
                        waitForComplete: async () => {
                            const log = await this.waitForComplete(receipt)

                            return { log, waitForThor: () => this.waitForThor(log.transactionHash) }
                        },
                    }
                },
            }
        }
    }
}

import { Percent, Token, TokenAmount } from '../entities'
import BigNumber from 'bignumber.js'
import { objectToBase64 } from './utils'

// @@
const WNEAR_TOKEN = new Token({
    chainId: 30001,
    address: 'wrap.testnet',
    decimals: 24,
    symbol: 'wNEAR',
    name: 'Wrapped NEAR',
    evm: false,
})

export class NearTrade {
    public tokenAmountIn: TokenAmount
    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public readonly callDataOffset = 0
    public priceImpact!: Percent
    public routerAddress!: string

    private readonly tokenOut: Token

    public constructor(tokenAmountIn: TokenAmount, tokenOut: Token) {
        this.tokenAmountIn = tokenAmountIn
        this.tokenOut = tokenOut
    }

    public async init() {
        // wnear -> usdc or usdc -> wnear
        // https://github.com/ref-finance/ref-ui/blob/d6d5ab4eff74d66fdf9e02b9a29f071211527b01/src/services/swap.ts#L217
        const response = await fetch('https://testnet-indexer.ref-finance.com/get-pool?pool_id=1159')

        const { token0_ref_price } = await response.json()

        const fromNear = this.tokenAmountIn.token.isNative

        let estimate: string
        let from: Token
        let to: Token
        if (fromNear) {
            estimate = new BigNumber(token0_ref_price)
                .multipliedBy(this.tokenAmountIn.toFixed())
                .shiftedBy(this.tokenOut.decimals)
                .toFixed(0)

            from = WNEAR_TOKEN
            to = this.tokenOut
        } else {
            estimate = new BigNumber(this.tokenAmountIn.toFixed())
                .dividedBy(token0_ref_price)
                .shiftedBy(this.tokenOut.decimals)
                .toFixed(0)
            from = this.tokenAmountIn.token
            to = WNEAR_TOKEN
        }

        const amountOut = new TokenAmount(this.tokenOut, estimate)

        const swapMsg = {
            receiver_id: 'ref-finance-101.testnet',
            amount: this.tokenAmountIn.raw.toString(),
            msg: JSON.stringify({
                force: 0,
                actions: [
                    {
                        pool_id: 1159,
                        token_in: from.address,
                        token_out: to.address,
                        amount_in: this.tokenAmountIn.raw.toString(),
                        min_amount_out: '0',
                    },
                ],
            }),
        }

        this.callData = objectToBase64(swapMsg)

        this.routerAddress = this.tokenAmountIn.token.address
        this.amountOut = amountOut
        this.route = [from, to]
        this.priceImpact = new Percent('0')
    }
}

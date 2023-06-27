import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { Weth__factory } from '../contracts'
import { SymbiosisTrade } from './symbiosisTrade'

export class WrapTrade implements SymbiosisTrade {
    tradeType = 'dex' as const

    public priceImpact: Percent = new Percent('0')

    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    public constructor(public tokenAmountIn: TokenAmount, private tokenOut: Token) {}

    public async init() {
        const wethInterface = Weth__factory.createInterface()

        if (this.tokenAmountIn.token.isNative) {
            const wethToken = wrappedToken(this.tokenAmountIn.token)

            this.route = [this.tokenAmountIn.token, wethToken]
            this.amountOut = new TokenAmount(wethToken, this.tokenAmountIn.raw)
            this.routerAddress = wethToken.address

            this.callData = wethInterface.encodeFunctionData('deposit')
        } else {
            this.route = [this.tokenAmountIn.token, this.tokenOut]
            this.amountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
            this.routerAddress = this.tokenAmountIn.token.address

            this.callData = wethInterface.encodeFunctionData('withdraw', [this.tokenAmountIn.raw.toString()])
            this.callDataOffset = 4 + 32

            throw new Error('Cannot unwrap weth yet')
        }

        return this
    }
}

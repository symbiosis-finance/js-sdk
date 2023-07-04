import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { Unwrapper__factory, Weth__factory } from '../contracts'
import type { SymbiosisTrade } from './symbiosisTrade'

const UNWRAP_ADDRESSES: Partial<Record<ChainId, string>> = {
    [ChainId.POLYGON_ZK]: '0x8a7F930003BedD63A1ebD99C5917FD6aE7E3dedf',
    [ChainId.ARBITRUM_NOVA]: '0x8a7F930003BedD63A1ebD99C5917FD6aE7E3dedf',
}

export class WrapTrade implements SymbiosisTrade {
    tradeType = 'wrap' as const

    public priceImpact: Percent = new Percent('0')

    public route!: Token[]
    public amountOut!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number

    public constructor(public tokenAmountIn: TokenAmount, private tokenOut: Token, private to: string) {}

    public static isSupported(tokenAmountIn: TokenAmount, tokenOut: Token): boolean {
        const wrappedInToken = wrappedToken(tokenAmountIn.token)
        if (tokenAmountIn.token.isNative && wrappedInToken.equals(tokenOut)) {
            // wrap
            return true
        }

        const unwrapAddress = UNWRAP_ADDRESSES[tokenAmountIn.token.chainId]
        const wrappedOutToken = wrappedToken(tokenOut)

        // unwrap
        return !!unwrapAddress && tokenOut.isNative && wrappedOutToken.equals(tokenAmountIn.token)
    }

    public async init() {
        const wethInterface = Weth__factory.createInterface()

        if (this.tokenAmountIn.token.isNative) {
            const wethToken = wrappedToken(this.tokenAmountIn.token)

            this.route = [this.tokenAmountIn.token, wethToken]
            this.amountOut = new TokenAmount(wethToken, this.tokenAmountIn.raw)
            this.routerAddress = wethToken.address

            this.callData = wethInterface.encodeFunctionData('deposit')
            return this
        }

        const unwrapperAddress = UNWRAP_ADDRESSES[this.tokenAmountIn.token.chainId]
        if (!unwrapperAddress) {
            throw new Error('Cannot unwrap on this network')
        }

        const unwrapperInterface = Unwrapper__factory.createInterface()

        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.amountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        this.routerAddress = unwrapperAddress

        this.callData = unwrapperInterface.encodeFunctionData('unwrap', [this.tokenAmountIn.raw.toString(), this.to])
        this.callDataOffset = 4 + 32

        return this
    }
}

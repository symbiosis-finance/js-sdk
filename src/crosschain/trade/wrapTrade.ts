import { ChainId } from '../../constants'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { Unwrapper__factory, Weth__factory } from '../contracts'
import { getFunctionSelector } from '../tron'
import type { SymbiosisTrade } from './symbiosisTrade'

const UNWRAP_ADDRESSES: Partial<Record<ChainId, string>> = {
    [ChainId.ETH_MAINNET]: '0x5ad095DE83693ba063941f2f2C5A0dF02383B651',
    [ChainId.MANTA_MAINNET]: '0xf39D9A9ABb98593ceaC395D7A37c572Da48fCfD5',
    [ChainId.LINEA_MAINNET]: '0xF5b0861e787706195c98E2F0d2D6EFBDAC1D1e08',
    [ChainId.POLYGON_ZK]: '0xf02bBC9de6e443eFDf3FC41851529C2c3B9E5e0C',
    [ChainId.BASE_MAINNET]: '0x8e1d36F9da8CFe842bCf8670A12ACd51c26d195D',
    [ChainId.SCROLL_MAINNET]: '0x42Cd64f48496dDdfEfF8F3704df9175dbe20d325',
    [ChainId.ARBITRUM_MAINNET]: '0x5Eb4ED9F745531221FAE41906e11d37642B15da6',
    [ChainId.ARBITRUM_NOVA]: '0xf02bBC9de6e443eFDf3FC41851529C2c3B9E5e0C',
    [ChainId.OPTIMISM_MAINNET]: '0x88139ad1199e8c78a0804d4bEBF4FbAD89EF9D89',
    [ChainId.ZKSYNC_MAINNET]: '0x1Cd08E632DfC63998add8840c8B9c97A4cA6DAb4',
    [ChainId.BOBA_MAINNET]: '0xA257F3FE4E4032291516DC355eDF90664e9eB932',
    [ChainId.MODE_MAINNET]: '0xE75C7E85FE6ADd07077467064aD15847E6ba9877',

    [ChainId.SCROLL_TESTNET]: '0x2135c0ab678F25E9cbB4BbBd55B68DE1E36D1E81',
    [ChainId.SCROLL_SEPOLIA]: '0x41151CEfFB743650E14425c7749019E491Fd1987',
    [ChainId.ETH_GOERLI]: '0xc9Fd2AF244FEfb31A62A5A33B9D6261Cec2cb7aA',

    [ChainId.SYMBIOSIS_ALPHA]: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38',
    [ChainId.SYMBIOSIS_BETA]: '0x6db1D2C691DcdF4DA36d3497F68a63C7282a4a44',
    [ChainId.SYMBIOSIS_GAMMA]: '0xBC4454Ee01EC5B6517333bD716f5135042ca1e38',
}

export class WrapTrade implements SymbiosisTrade {
    tradeType = 'wrap' as const

    public priceImpact: Percent = new Percent('0')

    public route!: Token[]
    public amountOut!: TokenAmount
    public amountOutMin!: TokenAmount
    public callData!: string
    public routerAddress!: string
    public callDataOffset?: number
    public functionSelector!: string

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
            this.amountOutMin = this.amountOut
            this.routerAddress = wethToken.address

            this.callData = wethInterface.encodeFunctionData('deposit')
            this.functionSelector = getFunctionSelector(wethInterface.getFunction('deposit'))
            return this
        }

        const unwrapperAddress = UNWRAP_ADDRESSES[this.tokenAmountIn.token.chainId]
        if (!unwrapperAddress) {
            throw new Error('Cannot unwrap on this network')
        }

        const unwrapperInterface = Unwrapper__factory.createInterface()

        this.route = [this.tokenAmountIn.token, this.tokenOut]
        this.amountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        this.amountOutMin = this.amountOut
        this.routerAddress = unwrapperAddress

        this.callData = unwrapperInterface.encodeFunctionData('unwrap', [this.tokenAmountIn.raw.toString(), this.to])
        this.functionSelector = getFunctionSelector(unwrapperInterface.getFunction('unwrap'))
        this.callDataOffset = 4 + 32

        return this
    }
}

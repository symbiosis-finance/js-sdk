import { ChainId } from '../../constants'
import { Unwrapper__factory, Weth__factory } from '../contracts'
import { getFunctionSelector } from '../chainUtils/tron'
import { SymbiosisTrade, SymbiosisTradeType } from './symbiosisTrade'
import { Percent, Token, TokenAmount, wrappedToken } from '../../entities'
import { BIPS_BASE } from '../constants'

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
    [ChainId.BLAST_MAINNET]: '0x2b7Aa8bDc40B6d3d19d0dE7480c4db8d5B6495e2',
    [ChainId.RSK_MAINNET]: '0x5b1bab64961cf72822817ef32950ff7fcab28b62',
    [ChainId.MERLIN_MAINNET]: '0x8a7F930003BedD63A1ebD99C5917FD6aE7E3dedf',
    [ChainId.ZKLINK_MAINNET]: '0xd17Ee77a10376Dab561d947F5e5FC5cf6de67441',
    [ChainId.SCROLL_SEPOLIA]: '0x97A5B271421b443b3F53F3DF485B2716Db85fA4b',
    [ChainId.SEPOLIA_TESTNET]: '0x97A5B271421b443b3F53F3DF485B2716Db85fA4b',
    [ChainId.TAIKO_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.GRAVITY_MAINNET]: '0x1cEaeda3D17936916D0F3E866Aa5Ef861F544840',
    [ChainId.BSQUARED_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.MORPH_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.GOAT_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.ABSTRACT_MAINNET]: '0xaEab9b650cd1e14b60a147B6F55f313E8d6644D5',
    [ChainId.UNICHAIN_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
    [ChainId.SONEIUM_MAINNET]: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab',
}

interface WrapTradeParams {
    tokenAmountIn: TokenAmount
    tokenOut: Token
    to: string
}

export class WrapTrade extends SymbiosisTrade {
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

    public constructor(params: WrapTradeParams) {
        super({ ...params, slippage: 0 })
    }

    public get tradeType(): SymbiosisTradeType {
        return 'wrap'
    }

    public async init() {
        const route = [this.tokenAmountIn.token, this.tokenOut]
        const priceImpact = new Percent('0', BIPS_BASE)

        if (this.tokenAmountIn.token.isNative) {
            const wethToken = wrappedToken(this.tokenAmountIn.token)

            const amountOut = new TokenAmount(wethToken, this.tokenAmountIn.raw)
            const amountOutMin = amountOut

            const wethInterface = Weth__factory.createInterface()
            const callData = wethInterface.encodeFunctionData('deposit')
            const functionSelector = getFunctionSelector(wethInterface.getFunction('deposit'))
            this.out = {
                amountOut,
                amountOutMin,
                routerAddress: wethToken.address,
                route,
                callData,
                functionSelector,
                callDataOffset: 0,
                minReceivedOffset: 0,
                priceImpact,
            }
            return this
        }

        const unwrapperAddress = UNWRAP_ADDRESSES[this.tokenAmountIn.token.chainId]
        if (!unwrapperAddress) {
            throw new Error('Cannot unwrap on this network')
        }

        const amountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        const amountOutMin = amountOut

        const unwrapperInterface = Unwrapper__factory.createInterface()
        const callData = unwrapperInterface.encodeFunctionData('unwrap', [this.tokenAmountIn.raw.toString(), this.to])
        const functionSelector = getFunctionSelector(unwrapperInterface.getFunction('unwrap'))

        this.out = {
            amountOut,
            amountOutMin,
            routerAddress: unwrapperAddress,
            route,
            callData,
            functionSelector,
            callDataOffset: 4 + 32,
            minReceivedOffset: 0,
            priceImpact,
        }
        return this
    }
}

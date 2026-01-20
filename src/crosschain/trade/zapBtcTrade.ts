import { Percent, TokenAmount, wrappedToken } from '../../entities'
import { getFunctionSelector } from '../chainUtils/tron'
import { BIPS_BASE } from '../constants'
import { Unwrapper__factory, Weth__factory } from '../contracts'
import { WrapTradeError } from '../sdkError'
import type { SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

export class ZapBtcTrade extends SymbiosisTrade {
    public static isSupported(): boolean {
        return true
    }

    public get tradeType(): SymbiosisTradeType {
        return 'zap-btc'
    }

    public async init() {
        const route = [this.tokenAmountIn.token, this.tokenOut]
        const priceImpact = new Percent('0', BIPS_BASE)

        if (this.tokenAmountIn.token.isNative) {
            const wethToken = wrappedToken(this.tokenAmountIn.token)

            const amountOut = new TokenAmount(wethToken, this.tokenAmountIn.raw)
            const amountOutMin = new TokenAmount(wethToken, this.tokenAmountInMin.raw)

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
            throw new WrapTradeError('Cannot unwrap on this network')
        }

        const amountOut = new TokenAmount(this.tokenOut, this.tokenAmountIn.raw)
        const amountOutMin = new TokenAmount(this.tokenOut, this.tokenAmountInMin.raw)

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

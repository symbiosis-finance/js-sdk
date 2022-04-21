import { ChainId } from 'src/constants'
import { Token } from 'src/entities'
import { Symbiosis } from './symbiosis'
import { UniLikeTrade } from './uniLikeTrade'

export class DataProvider {
    constructor(private readonly symbiosis: Symbiosis) {}

    getRepresentation(token: Token, chainId: ChainId) {
        return this.symbiosis.getRepresentation(token, chainId)
    }

    getTokenIndex(tokenIn: Token, tokenOut: Token, address: string) {
        const nervePool = this.symbiosis.nervePool(tokenIn, tokenOut)

        return nervePool.getTokenIndex(address)
    }

    getPairs(tokenIn: Token, tokenOut: Token) {
        const provider = this.symbiosis.getProvider(tokenIn.chainId)

        return UniLikeTrade.getPairs(provider, tokenIn, tokenOut)
    }
}

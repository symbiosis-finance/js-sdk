import { Token, TokenAmount } from '../entities'

import { BaseSwapping, SwapExactIn } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): SwapExactIn {
        return this.doExactIn(tokenAmountIn, tokenOut, from, to, revertableAddress, slippage, deadline, use1Inch)
    }
}

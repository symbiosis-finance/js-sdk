import { Token, TokenAmount } from '../entities'

import { BaseSwapping, SwapExactIn, SwapOptions } from './baseSwapping'

export class Swapping extends BaseSwapping {
    public async exactIn(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        useAggregators = true,
        options?: SwapOptions
    ): SwapExactIn {
        return this.doExactIn(
            tokenAmountIn,
            tokenOut,
            from,
            to,
            revertableAddress,
            slippage,
            deadline,
            useAggregators,
            options
        )
    }
}

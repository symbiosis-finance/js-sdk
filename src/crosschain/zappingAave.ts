import { SwapExactIn, BaseSwapping } from './baseSwapping'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { Aave, MulticallRouter } from './contracts'

export class ZappingAave extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected aavePool!: Aave
    protected aToken!: string

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
        this.multicallRouter = this.symbiosis.multicallRouter(tokenOut.chainId)
        this.userAddress = to

        this.aavePool = this.symbiosis.aavePool(tokenOut.chainId)
        const data = await this.aavePool.getReserveData(tokenOut.address)
        this.aToken = data.aTokenAddress

        return this.doExactIn(
            tokenAmountIn,
            wrappedToken(tokenOut),
            from,
            this.multicallRouter.address,
            revertableAddress,
            slippage,
            deadline,
            use1Inch
        )
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

    protected swapTokens(): string[] {
        const tokens = this.transit.route.map((i) => i.address)
        if (this.tradeC) {
            tokens.push(wrappedToken(this.tradeC.amountOut.token).address)
        } else {
            tokens.push(this.aToken)
        }
        return tokens
    }

    private buildMulticall() {
        const callDatas = []
        const receiveSides = []
        const path = []
        const offsets = []

        let amount
        let supplyToken

        if (this.tradeC) {
            amount = this.tradeC.tokenAmountIn.raw.toString()
            supplyToken = this.tradeC.amountOut.token

            callDatas.push(this.tradeC.callData)
            receiveSides.push(this.tradeC.routerAddress)
            path.push(this.tradeC.tokenAmountIn.token.address)
            offsets.push(this.tradeC.callDataOffset!)
        } else {
            amount = this.transit.amountOut.raw.toString()
            if (this.transit.direction === 'mint') {
                supplyToken = this.transit.amountOut.token
            } else {
                supplyToken = this.transit.feeToken
            }
        }

        const supplyCalldata = this.aavePool.interface.encodeFunctionData('supply', [
            supplyToken.address,
            '0', // amount will be patched
            this.userAddress,
            '0',
        ])

        callDatas.push(supplyCalldata)
        receiveSides.push(this.aavePool.address)
        path.push(supplyToken.address)
        offsets.push(68)

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount,
            callDatas,
            receiveSides,
            path,
            offsets,
            this.userAddress,
        ])
    }
}

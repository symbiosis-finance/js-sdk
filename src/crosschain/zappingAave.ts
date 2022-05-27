import { SwapExactIn, Swapping } from './swapping'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { Aave, MulticallRouter } from './contracts'

export class ZappingAave extends Swapping {
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
        use1Inch = false
    ): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(tokenOut.chainId)
        this.userAddress = to

        this.aavePool = this.symbiosis.aavePool(tokenOut.chainId)
        const data = await this.aavePool.getReserveData(tokenOut.address)
        this.aToken = data.aTokenAddress

        return super.exactIn(
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
        const tokens = this.tradeB.route.map((i) => i.address)
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
        let supplyTokenAmount

        if (this.tradeC) {
            amount = this.tradeC.tokenAmountIn.raw.toString()
            supplyTokenAmount = this.tradeC.amountOut

            callDatas.push(this.tradeC.callData)
            receiveSides.push(this.tradeC.routerAddress)
            path.push(this.tradeC.tokenAmountIn.token.address)
            offsets.push(this.tradeC.callDataOffset!)
        } else {
            amount = this.tradeB.amountOut.raw.toString()
            supplyTokenAmount = this.tradeB.amountOut
        }

        const supplyCalldata = this.aavePool.interface.encodeFunctionData('supply', [
            supplyTokenAmount.token.address,
            supplyTokenAmount.raw.toString(),
            this.userAddress,
            '0',
        ])

        callDatas.push(supplyCalldata)
        receiveSides.push(this.aavePool.address)
        path.push(supplyTokenAmount.token.address)
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

import { SwapExactIn, Swapping } from './swapping'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { MulticallRouter } from './contracts'

export class ZappingAave extends Swapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected callData!: string

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
        this.buildMulticall()
        return this.callData
    }

    protected finalOffset(): number {
        return 36
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

        const aavePool = this.symbiosis.aavePool(supplyTokenAmount.token.chainId)
        const supplyCalldata = aavePool.interface.encodeFunctionData('supply', [
            supplyTokenAmount.token.address,
            supplyTokenAmount.raw.toString(),
            this.userAddress,
            '0',
        ])

        callDatas.push(supplyCalldata)
        receiveSides.push(aavePool.address)
        path.push(supplyTokenAmount.token.address)
        offsets.push(68)

        this.callData = this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount,
            callDatas,
            receiveSides,
            path,
            offsets,
            this.userAddress,
        ])
    }
}

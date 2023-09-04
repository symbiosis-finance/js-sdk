import { SwapExactIn, BaseSwapping, SwapExactInParams } from './baseSwapping'
import { wrappedToken } from '../entities'
import { Mahalend, MulticallRouter } from './contracts'

export class ZappingMahalend extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected mahalendPool!: Mahalend
    protected aToken!: string

    public async exactIn({
        tokenAmountIn,
        tokenOut,
        from,
        to,
        revertableAddress,
        slippage,
        deadline,
    }: SwapExactInParams): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(tokenOut.chainId)
        this.userAddress = to

        this.mahalendPool = this.symbiosis.mahalendPool(tokenOut.chainId)
        const data = await this.mahalendPool.getReserveData(tokenOut.address)
        this.aToken = data.aTokenAddress

        return this.doExactIn({
            tokenAmountIn,
            tokenOut: wrappedToken(tokenOut),
            from,
            to,
            revertableAddress,
            slippage,
            deadline,
        })
    }

    protected tradeCTo(): string {
        return this.multicallRouter.address
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

    protected extraSwapTokens(): string[] {
        return [this.aToken]
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

        const supplyCalldata = this.mahalendPool.interface.encodeFunctionData('supply', [
            supplyToken.address,
            '0', // amount will be patched
            this.userAddress,
            '0',
        ])

        callDatas.push(supplyCalldata)
        receiveSides.push(this.mahalendPool.address)
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

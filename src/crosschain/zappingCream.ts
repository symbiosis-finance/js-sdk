import { SwapExactIn, Swapping } from './swapping'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { CreamCErc20__factory, MulticallRouter } from './contracts'
import { getMulticall } from './multicall'

export class ZappingCream extends Swapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected callData!: string

    private creamPoolAddress!: string

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
        const wrappedTokenOut = wrappedToken(tokenOut)
        const chainIdOut = wrappedTokenOut.chainId

        this.multicallRouter = this.symbiosis.multicallRouter(chainIdOut)
        this.userAddress = to

        const comptroller = this.symbiosis.creamComptroller(chainIdOut)
        const markets = await comptroller.getAllMarkets()

        const creamCErc20Interface = CreamCErc20__factory.createInterface()
        const calls = markets.map((market) => {
            return {
                target: market,
                callData: creamCErc20Interface.encodeFunctionData('underlying'),
            }
        })

        const multicall = await getMulticall(comptroller.provider)
        const aggregated = await multicall.callStatic.tryAggregate(false, calls)

        const underlying = aggregated.map(([success, returnData]): string | undefined => {
            if (!success || returnData === '0x') return
            return creamCErc20Interface.decodeFunctionResult('underlying', returnData).toString().toLowerCase()
        })

        const index = underlying.indexOf(wrappedTokenOut.address.toLowerCase())
        if (index === -1) {
            throw new Error(
                `Cream: cannot to find underlying token ${wrappedTokenOut.address} on chain ${wrappedTokenOut.chain?.name}`
            )
        }
        this.creamPoolAddress = calls[index].target

        return super.exactIn(
            tokenAmountIn,
            wrappedTokenOut,
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
            amount = this.tradeB.tokenAmountIn.raw.toString()
            supplyTokenAmount = this.tradeB.amountOut
        }

        const cream = this.symbiosis.creamCErc20ByAddress(this.creamPoolAddress, supplyTokenAmount.token.chainId)
        const supplyCalldata = cream.interface.encodeFunctionData('mint', [supplyTokenAmount.raw.toString()])

        callDatas.push(supplyCalldata)
        receiveSides.push(cream.address)
        path.push(supplyTokenAmount.token.address)
        offsets.push(36)

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

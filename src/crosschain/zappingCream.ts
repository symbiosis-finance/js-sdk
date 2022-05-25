import { SwapExactIn, Swapping } from './swapping'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { CreamCErc20__factory, CreamComptroller__factory, Multicall, MulticallRouter } from './contracts'
import { getMulticall } from './multicall'
import { ChainId } from '../constants'

type Market = {
    market: string
    underlying: string
    paused: boolean
}

export class ZappingCream extends Swapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected callData!: string

    private creamPoolAddress!: string

    public async getAllMarkets(chainId: ChainId): Promise<Market[]> {
        const comptroller = this.symbiosis.creamComptroller(chainId)
        const multicall = await getMulticall(comptroller.provider)
        const markets = await comptroller.getAllMarkets()
        const marketsWithUnderlying = await this.reduceUnderlying(multicall, markets)
        return this.reducePaused(multicall, comptroller.address, marketsWithUnderlying)
    }

    private async reduceUnderlying(multicall: Multicall, markets: string[]): Promise<Market[]> {
        const creamCErc20Interface = CreamCErc20__factory.createInterface()
        const calls = markets.map((market) => {
            return {
                target: market,
                callData: creamCErc20Interface.encodeFunctionData('underlying'),
            }
        })

        const aggregated = await multicall.callStatic.tryAggregate(false, calls)
        return aggregated
            .map(([success, returnData], i): Market | undefined => {
                if (!success || returnData === '0x') return
                return {
                    market: markets[i],
                    underlying: creamCErc20Interface
                        .decodeFunctionResult('underlying', returnData)
                        .toString()
                        .toLowerCase(),
                    paused: false,
                }
            })
            .filter((i) => i !== undefined) as Market[]
    }

    private async reducePaused(multicall: Multicall, target: string, markets: Market[]): Promise<Market[]> {
        const comptrollerInterface = CreamComptroller__factory.createInterface()

        const calls = markets.map((marketWithUnderlying) => {
            return {
                target,
                callData: comptrollerInterface.encodeFunctionData('mintGuardianPaused', [marketWithUnderlying.market]),
            }
        })
        const aggregated = await multicall.callStatic.tryAggregate(false, calls)
        return aggregated
            .map(([success, returnData], i): Market | undefined => {
                if (!success || returnData === '0x') return
                const paused = comptrollerInterface.decodeFunctionResult('mintGuardianPaused', returnData)[0]

                return { ...markets[i], paused }
            })
            .filter((i) => !!i) as Market[]
    }

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

        const markets = await this.getAllMarkets(chainIdOut)

        const index = markets.map((i) => i.underlying).indexOf(wrappedTokenOut.address.toLowerCase())
        if (index === -1) {
            throw new Error(
                `Cream: cannot to find underlying token ${wrappedTokenOut.address} on chain ${wrappedTokenOut.chain?.name}`
            )
        }

        if (markets[index].paused) {
            throw new Error(`Cream: market ${markets[index].market} on chain ${wrappedTokenOut.chain?.name} is paused`)
        }

        this.creamPoolAddress = markets[index].market

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

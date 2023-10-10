import { BaseSwapping, SwapExactIn, SwapExactInParams } from './baseSwapping'
import { wrappedToken } from '../entities'
import { CreamCErc20__factory, CreamComptroller__factory, Multicall, MulticallRouter } from './contracts'
import { getMulticall } from './multicall'
import { ChainId } from '../constants'

type Market = {
    market: string
    underlying: string
    paused: boolean
}

export class ZappingCream extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string

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

    public async exactIn({
        tokenAmountIn,
        tokenOut,
        from,
        to,
        slippage,
        deadline,
    }: SwapExactInParams): Promise<SwapExactIn> {
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

        return this.doExactIn({
            tokenAmountIn,
            tokenOut: wrappedTokenOut,
            from,
            to,
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
        const { callData } = this.buildMulticall()
        return callData
    }

    protected finalOffset(): number {
        return 36
    }

    protected extraSwapTokens(): string[] {
        const { supplyAddress } = this.buildMulticall()
        return [supplyAddress]
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

        const cream = this.symbiosis.creamCErc20ByAddress(this.creamPoolAddress, supplyToken.chainId)
        const supplyCalldata = cream.interface.encodeFunctionData('mint', ['0']) // amount will be patched

        callDatas.push(supplyCalldata)
        receiveSides.push(cream.address)
        path.push(supplyToken.address)
        path.push(cream.address)
        offsets.push(36)

        const callData = this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount,
            callDatas,
            receiveSides,
            path,
            offsets,
            this.userAddress,
        ])

        return {
            callData,
            supplyAddress: cream.address,
        }
    }
}

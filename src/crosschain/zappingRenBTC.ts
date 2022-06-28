import { SwapExactIn, BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { MulticallRouter, RenMintGatewayV3 } from './contracts'
import { ChainId } from 'src/constants'

export class ZappingRenBTC extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected renMintGatewayV3!: RenMintGatewayV3
    protected renBTCAddress!: string

    public async exactIn(
        tokenAmountIn: TokenAmount,
        renChainId: ChainId,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = false
    ): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(renChainId)
        this.userAddress = to

        const renRenGatewayRegistry = this.symbiosis.renRenGatewayRegistry(renChainId)

        this.renBTCAddress = await renRenGatewayRegistry.getRenAssetBySymbol('BTC')

        const renBTC = new Token({
            address: this.renBTCAddress,
            chainId: renChainId,
            decimals: 8,
            name: 'renBTC',
        })

        const mintGatewayAddress = await renRenGatewayRegistry.getMintGatewayBySymbol('BTC')

        this.renMintGatewayV3 = this.symbiosis.renMintGatewayByAddress(mintGatewayAddress, renChainId)

        return this.doExactIn(
            tokenAmountIn,
            renBTC,
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

        const supplyCalldata = this.renMintGatewayV3.interface.encodeFunctionData('burn', [this.to, amount])

        callDatas.push(supplyCalldata)
        receiveSides.push(this.renMintGatewayV3.address)
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

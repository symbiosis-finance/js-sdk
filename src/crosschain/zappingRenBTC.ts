import { ChainId } from 'src/constants'
import { SwapExactIn, BaseSwapping } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { MulticallRouter, RenMintGatewayV3 } from './contracts'

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
        if (!this.tradeC) {
            throw new Error('TradeC is not set')
        }

        if (!this.tradeC.callDataOffset) {
            throw new Error('TradeC is not initialized')
        }

        const burnCalldata = (this.renMintGatewayV3.interface as any).encodeFunctionData('burn(string,uint256)', [
            this.userAddress,
            this.tradeC.amountOut.raw.toString(),
        ])

        const callDatas = [this.tradeC.callData, burnCalldata]
        const receiveSides = [this.tradeC.routerAddress, this.renMintGatewayV3.address]
        const path = [this.tradeC.tokenAmountIn.token.address, this.tradeC.amountOut.token.address]
        const offsets = [this.tradeC.callDataOffset, 68]

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.tradeC.tokenAmountIn.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.from,
        ])
    }
}

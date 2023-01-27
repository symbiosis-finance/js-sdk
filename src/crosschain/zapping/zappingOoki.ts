import { Contract } from '@ethersproject/contracts'
import { ChainId } from 'src/constants'
import ERC20 from '../../abis/ERC20.json'
import { Token, TokenAmount } from '../../entities'
import { SwapExactIn, BaseSwapping } from '../baseSwapping'
import { MulticallRouter, Ooki } from '../contracts'

export class ZappingOoki extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected iToken!: Ooki
    protected iTokenAddress!: string

    public async exactIn(
        tokenAmountIn: TokenAmount,
        iTokenAddress: string,
        chainId: ChainId,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        useAggregators = true
    ): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(chainId)
        this.userAddress = to

        this.iToken = this.symbiosis.ookiIToken(iTokenAddress, chainId)

        const tokenAddress = await this.iToken.loanTokenAddress()
        const tokenContract = new Contract(tokenAddress, ERC20, this.symbiosis.providers.get(chainId))
        const decimals = await tokenContract.decimals()

        const token = new Token({
            address: tokenAddress,
            chainId: chainId,
            decimals,
        })

        return this.doExactIn(tokenAmountIn, token, from, to, revertableAddress, slippage, deadline, useAggregators)
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
        return [this.iTokenAddress]
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

        const ookiCalldata = this.iToken.interface.encodeFunctionData('mint', [this.userAddress, amount])

        callDatas.push(ookiCalldata)
        receiveSides.push(this.iToken.address)
        path.push(supplyToken.address, this.iToken.address)
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

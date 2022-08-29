import { Contract } from '@ethersproject/contracts'
import { ChainId } from 'src/constants'
import ERC20 from '../abis/ERC20.json'
import { Token, TokenAmount, wrappedToken } from '../entities'
import { SwapExactIn, BaseSwapping } from './baseSwapping'
import { BeefyVault, MulticallRouter } from './contracts'

export class ZappingBeefy extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected beefyVault!: BeefyVault
    protected aToken!: string

    public async exactIn(
        tokenAmountIn: TokenAmount,
        vaultAddress: string,
        vaultChainId: ChainId,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(vaultChainId)
        this.userAddress = to

        this.beefyVault = this.symbiosis.beefyVault(vaultAddress, vaultChainId)

        const tokenAddress = await this.beefyVault.want()
        const tokenContract = new Contract(tokenAddress, ERC20, this.symbiosis.providers.get(vaultChainId))
        const decimals = await tokenContract.decimals()

        const token = new Token({
            address: tokenAddress,
            chainId: vaultChainId,
            decimals,
        })

        return this.doExactIn(
            tokenAmountIn,
            token,
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

        const beefyCalldata = this.beefyVault.interface.encodeFunctionData('deposit', ['0']) // amount will be patched

        callDatas.push(beefyCalldata)
        receiveSides.push(this.beefyVault.address)
        path.push(supplyToken.address, this.beefyVault.address)
        offsets.push(36)

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

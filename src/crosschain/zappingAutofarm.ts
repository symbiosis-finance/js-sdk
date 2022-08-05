import { ChainId } from 'src/constants'
import { Token, TokenAmount } from '../entities'
import { BaseSwapping, SwapExactIn } from './baseSwapping'
import { AlpacaVault, AutoFarmV2, MulticallRouter } from './contracts'
import ERC20 from '../abis/ERC20.json'
import { Contract } from '@ethersproject/contracts'

const AutoFarmPIDTokens: Record<number, string> = {
    486: '0xd7D069493685A581d27824Fc46EdA46B7EfC0063', // ibWBNB
    487: '0xf1bE8ecC990cBcb90e166b71E368299f0116d421', // ibALPACA
    488: '0x7C9e73d4C71dae564d41F78d56439bB4ba87592f', // ibBUSD
    489: '0x158Da805682BdC8ee32d52833aD41E74bb951E59', // ibUSDT
    490: '0x3282d2a151ca00BfE7ed17Aa16E42880248CD3Cd', // ibTUSD
    491: '0x08FC9Ba2cAc74742177e0afC3dC8Aed6961c24e7', // ibBTCB
    492: '0xbfF4a34A4644a113E8200D7F1D79b3555f723AfE', // ibETH
}

export class ZappingAutoFarm extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected autoFarmPID!: number
    protected alpacaVault!: AlpacaVault
    protected autoFarm!: AutoFarmV2

    public async exactIn(
        tokenAmountIn: TokenAmount,
        autoFarmChainId: ChainId,
        autoFarmPID: number,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        use1Inch = true
    ): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(autoFarmChainId)
        this.autoFarm = this.symbiosis.autoFarm(autoFarmChainId)
        this.userAddress = to
        this.autoFarmPID = autoFarmPID

        const alpacaTokenAddress = AutoFarmPIDTokens[autoFarmPID]

        this.alpacaVault = this.symbiosis.alpacaVault(alpacaTokenAddress, autoFarmChainId)

        const tokenAddress = await this.alpacaVault.token()

        const tokenContract = new Contract(tokenAddress, ERC20, this.symbiosis.providers.get(autoFarmChainId))
        const decimals = await tokenContract.decimals()

        const token = new Token({
            address: tokenAddress,
            chainId: autoFarmChainId,
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

        const alpacaCalldata = this.alpacaVault.interface.encodeFunctionData('deposit', ['0']) // amount will be patched
        const autoFarmCalldata = this.autoFarm.interface.encodeFunctionData('deposit', [
            this.autoFarmPID.toString(),
            '0',
        ]) // amount will be patched

        callDatas.push(alpacaCalldata, autoFarmCalldata)
        receiveSides.push(this.alpacaVault.address, this.autoFarm.address)
        path.push(supplyToken.address, this.alpacaVault.address)
        offsets.push(36, 68)

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount,
            callDatas,
            receiveSides,
            path,
            offsets,
            this.to,
        ])
    }
}

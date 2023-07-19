import { SwapExactIn, BaseSwapping, SwapExactInParams } from './baseSwapping'
import { Token, wrappedToken } from '../entities'
import { MulticallRouter, SyncSwapLaunchPool, SyncSwapLaunchPool__factory } from './contracts'
import { ChainId } from '../constants'
import JSBI from 'jsbi'
import type { Symbiosis } from './symbiosis'
import { OmniPoolConfig } from './types'

interface ZappingSyncSwapLaunchPoolParams {
    symbiosis: Symbiosis
    chainId: ChainId
    address: string
    token: Token
    omniPoolConfig: OmniPoolConfig
}

export class ZappingSyncSwapLaunchPool extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected pool!: SyncSwapLaunchPool

    protected chainId: ChainId
    protected address: string
    protected tokenOut: Token

    constructor({ address, chainId, symbiosis, token, omniPoolConfig }: ZappingSyncSwapLaunchPoolParams) {
        super(symbiosis, omniPoolConfig)

        this.chainId = chainId
        this.address = address
        this.tokenOut = token
    }

    public async exactIn({
        tokenAmountIn,
        from,
        to,
        revertableAddress,
        slippage,
        deadline,
    }: SwapExactInParams): SwapExactIn {
        this.multicallRouter = this.symbiosis.multicallRouter(this.chainId)
        this.userAddress = to

        this.pool = SyncSwapLaunchPool__factory.connect(this.address, this.symbiosis.getProvider(this.chainId))

        return this.doExactIn({
            tokenAmountIn,
            tokenOut: wrappedToken(this.tokenOut),
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
        return []
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
            if (this.transit.isV2()) {
                let rawAmount = this.transit.amountOut.raw
                if (this.feeV2) {
                    rawAmount = JSBI.subtract(rawAmount, this.feeV2.raw)
                }

                amount = rawAmount.toString()
                supplyToken = this.tokenOut
            } else {
                amount = this.transit.amountOut.raw.toString()
                supplyToken = this.transit.amountOut.token
            }
        }

        const supplyCalldata = this.pool.interface.encodeFunctionData('contribute', [
            '0', // will be patched
            this.to,
        ])

        callDatas.push(supplyCalldata)
        receiveSides.push(this.pool.address)
        path.push(supplyToken.address)
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

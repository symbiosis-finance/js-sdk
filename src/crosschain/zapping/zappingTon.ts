import { Signer } from 'ethers'
import { ChainId } from '../../constants'
import { Token, TokenAmount } from '../../entities'
import { BaseSwapping, SwapExactIn } from '../baseSwapping'
import { MulticallRouter, WTon } from '../contracts'

export type ZappingTonExactIn = Promise<
    Omit<Awaited<SwapExactIn>, 'execute'> & {
        execute: ReturnType<ZappingTon['buildExecute']>
        tonAmountOut: TokenAmount
    }
>

export class ZappingTon extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected wTon!: WTon
    protected tonChainId!: ChainId

    public async exactIn(
        tokenAmountIn: TokenAmount,
        tonChainId: ChainId,
        from: string,
        to: string,
        revertableAddress: string,
        slippage: number,
        deadline: number,
        useAggregators = true
    ): ZappingTonExactIn {
        this.from = from
        this.tonChainId = tonChainId
        this.multicallRouter = this.symbiosis.multicallRouter(tonChainId)
        this.userAddress = to
        this.revertableAddress = revertableAddress

        // @@ Real address
        this.wTon = this.symbiosis.wTon(tonChainId)

        const wTonToken = new Token({
            address: this.wTon.address,
            chainId: tonChainId,
            decimals: 9,
            name: 'Wrapped Toncoin',
            symbol: 'wTon',
            icons: {
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
            },
        })

        const { tokenAmountOut, execute, ...result } = await this.doExactIn(
            tokenAmountIn,
            wTonToken,
            from,
            from,
            revertableAddress,
            slippage,
            deadline,
            useAggregators
        )

        const tonAmountOut = tokenAmountOut // @@

        return {
            ...result,
            execute: this.buildExecute(execute),
            tonAmountOut: tokenAmountOut,
            tokenAmountOut: tonAmountOut,
        }
    }

    // protected tradeCTo(): string {
    //     return this.multicallRouter.address
    // }

    // protected finalReceiveSide(): string {
    //     return this.multicallRouter.address
    // }

    // protected finalCalldata(): string | [] {
    //     return this.buildMulticall()
    // }

    // protected finalOffset(): number {
    //     return 36
    // }

    // private buildMulticall() {
    //     if (!this.tradeC) {
    //         throw new Error('TradeC is not set')
    //     }

    //     if (!this.tradeC.callDataOffset) {
    //         throw new Error('TradeC is not initialized')
    //     }

    //     const burnCalldata = this.wTon.interface.encodeFunctionData('burn', [
    //         this.tradeC.amountOut.raw.toString(),
    //         {
    //             workchain: 0,
    //             address_hash: '0x1e0fb0686f99f058d8e02ff0355f835988c3069ba1510f76a5c028defcf81706', // testnet
    //         },
    //     ])

    //     const callDatas = [this.tradeC.callData, burnCalldata]
    //     const receiveSides = [this.tradeC.routerAddress, this.wTon.address]
    //     const path = [this.tradeC.tokenAmountIn.token.address, this.tradeC.amountOut.token.address]
    //     const offsets = [this.tradeC.callDataOffset, 36]

    //     return this.multicallRouter.interface.encodeFunctionData('multicall', [
    //         this.tradeC.tokenAmountIn.raw.toString(),
    //         callDatas,
    //         receiveSides,
    //         path,
    //         offsets,
    //         this.from,
    //     ])
    // }

    private buildExecute(execute: Awaited<SwapExactIn>['execute']) {
        return async (signer: Signer) => {
            const { response, waitForMined } = await execute(signer)

            return {
                response,
                waitForMined: async () => {
                    const { receipt } = await waitForMined()

                    return {
                        receipt,
                        waitForComplete: async () => {
                            const log = await this.waitForComplete(receipt)

                            return { log, waitForTon: () => 'done' }
                        },
                    }
                },
            }
        }
    }
}

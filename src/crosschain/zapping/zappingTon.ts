import { parseUnits } from '@ethersproject/units'
import { BigNumber, Signer } from 'ethers'
import { ChainId } from '../../constants'
import { Token, TokenAmount } from '../../entities'
import { BaseSwapping, SwapExactIn } from '../baseSwapping'
import { MulticallRouter, WTon } from '../contracts'
import { Error as SymbiosisError, ErrorCode } from '../error'

export type ZappingTonExactIn = Promise<
    Omit<Awaited<SwapExactIn>, 'execute'> & {
        execute: ReturnType<ZappingTon['buildExecute']>
        tonAmountOut: TokenAmount
        bridgeFee: TokenAmount
    }
>

const TON_TOKEN_DECIMALS = 9
const MIN_WTON_AMOUNT = parseUnits('10', TON_TOKEN_DECIMALS)
const STATIC_BRIDGE_FEE = parseUnits('5', TON_TOKEN_DECIMALS)

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

        this.wTon = this.symbiosis.wTon(tonChainId)

        const wTonToken = new Token({
            address: this.wTon.address,
            chainId: tonChainId,
            decimals: TON_TOKEN_DECIMALS,
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

        const bridgeFee = this.estimateBridgeFee(tokenAmountOut)

        const tonAmountOut = new TokenAmount(
            new Token({
                address: '',
                chainId: ChainId.TON_MAINNET,
                decimals: TON_TOKEN_DECIMALS,
                name: 'Toncoin',
                symbol: 'TON',
                isNative: true,
                icons: {
                    small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
                    large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
                },
            }),
            tokenAmountOut.subtract(bridgeFee).raw.toString()
        )

        if (BigNumber.from(tonAmountOut.raw.toString()).lt(MIN_WTON_AMOUNT.toString())) {
            throw new SymbiosisError(
                `Amount $${tonAmountOut.toSignificant()} less than fee $${tonAmountOut.toSignificant}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }

        return {
            ...result,
            execute: this.buildExecute(execute),
            tonAmountOut: tokenAmountOut,
            tokenAmountOut: tonAmountOut,
            bridgeFee,
        }
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

    private buildMulticall() {
        if (!this.tradeC) {
            throw new Error('TradeC is not set')
        }

        if (!this.tradeC.callDataOffset) {
            throw new Error('TradeC is not initialized')
        }

        // @@ Convert adderss to hex

        const burnCalldata = this.wTon.interface.encodeFunctionData('burn', [
            this.tradeC.amountOut.raw.toString(),
            {
                workchain: 0,
                address_hash: '0x1e0fb0686f99f058d8e02ff0355f835988c3069ba1510f76a5c028defcf81706', // testnet
            },
        ])

        const callDatas = [this.tradeC.callData, burnCalldata]
        const receiveSides = [this.tradeC.routerAddress, this.wTon.address]
        const path = [this.tradeC.tokenAmountIn.token.address, this.tradeC.amountOut.token.address]
        const offsets = [this.tradeC.callDataOffset, 36]

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            this.tradeC.tokenAmountIn.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.from,
        ])
    }

    private estimateBridgeFee(tokenAmountOut: TokenAmount): TokenAmount {
        const MULTIPLIER = BigNumber.from('100')
        const PERCENT = BigNumber.from('25') // 0.25%

        const tonPercentFee = BigNumber.from(tokenAmountOut.raw.toString()).mul(PERCENT).div(MULTIPLIER.mul('100'))

        return new TokenAmount(tokenAmountOut.token, STATIC_BRIDGE_FEE.add(tonPercentFee).toString())
    }

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

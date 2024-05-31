import { formatUnits, parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'
import TonWeb from 'tonweb'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { MulticallRouter, TonBridge } from './contracts'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { OneInchProtocols } from './trade/oneInchTrade'

export const TON_TOKEN_DECIMALS = 9
const MIN_WTON_AMOUNT = parseUnits('10', TON_TOKEN_DECIMALS)
const STATIC_BRIDGE_FEE = parseUnits('5', TON_TOKEN_DECIMALS)

const TON = new Token({
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
})
export type Option = { chainId: ChainId; bridge: string; wTon: Token }

export interface ZappingTonExactInParams {
    tokenAmountIn: TokenAmount
    option: Option
    from: string
    to: string
    slippage: number
    deadline: number
    oneInchProtocols?: OneInchProtocols
}
export class ZappingTon extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected userAddress!: string
    protected tonBridge!: TonBridge

    public async exactIn({
        tokenAmountIn,
        option,
        from,
        to,
        slippage,
        deadline,
    }: ZappingTonExactInParams): Promise<CrosschainSwapExactInResult> {
        this.from = from
        this.userAddress = to
        this.multicallRouter = this.symbiosis.multicallRouter(option.chainId)
        this.tonBridge = this.symbiosis.tonBridge(option.chainId, option.bridge)

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: option.wTon,
            from,
            to: from,
            slippage,
            deadline,
        })

        const { tokenAmountOut, ...rest } = result

        let tonAmountOut = new TokenAmount(TON, tokenAmountOut.raw.toString())
        if (BigNumber.from(tonAmountOut.raw.toString()).lt(MIN_WTON_AMOUNT.toString())) {
            throw new Error(`Min bridge amount is ${formatUnits(MIN_WTON_AMOUNT, 9)} TON`, ErrorCode.MIN_TON_AMOUNT_IN)
        }
        const bridgeFee = this.estimateBridgeFee(tokenAmountOut)
        tonAmountOut = tonAmountOut.subtract(bridgeFee)

        return {
            ...rest,
            tokenAmountOut: tonAmountOut,
            tokenAmountOutMin: tonAmountOut,
            extraFee: bridgeFee,
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

        const address = new TonWeb.utils.Address(this.userAddress)

        const bridgeCallData = this.tonBridge.interface.encodeFunctionData('callBridgeRequest', [
            this.tradeC.amountOut.raw.toString(),
            {
                workchain: address.wc,
                address_hash: `0x${TonWeb.utils.bytesToHex(address.hashPart)}`,
            },
        ])

        const callDatas = [this.tradeC.callData, bridgeCallData]
        const receiveSides = [this.tradeC.routerAddress, this.tonBridge.address]
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

        return new TokenAmount(TON, STATIC_BRIDGE_FEE.add(tonPercentFee).toString())
    }
}

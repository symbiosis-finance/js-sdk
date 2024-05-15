import { parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'
import TonWeb from 'tonweb'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { MulticallRouter, TonBridge } from './contracts'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { OneInchProtocols } from './trade/oneInchTrade'

const TON_TOKEN_DECIMALS = 9
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

const CONFIG: Partial<Record<ChainId, { bridge: string; wTon: Token }>> = {
    [ChainId.SEPOLIA_TESTNET]: {
        bridge: '0xe7c0F17555CFC962fe96fcd274B653A8bff708B6',
        wTon: new Token({
            chainId: ChainId.SEPOLIA_TESTNET,
            address: '0x331f40cc27aC106e1d5242CE633dc6436626a6F8',
            decimals: TON_TOKEN_DECIMALS,
            name: 'Wrapped Toncoin',
            symbol: 'wTon',
            icons: {
                small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
                large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
            },
        }),
    },
}

export interface ZappingTonExactInParams {
    tokenAmountIn: TokenAmount
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
    protected tonChainId!: ChainId

    public async exactIn({
        tokenAmountIn,
        from,
        to,
        slippage,
        deadline,
    }: ZappingTonExactInParams): Promise<CrosschainSwapExactInResult> {
        const tonChainId = ChainId.SEPOLIA_TESTNET // FIXME

        this.from = from
        this.tonChainId = tonChainId
        this.multicallRouter = this.symbiosis.multicallRouter(tonChainId)
        this.userAddress = to

        const config = CONFIG[tonChainId]
        if (!config) {
            throw new Error(`There are no wTon for chain ${tonChainId}`)
        }

        this.tonBridge = this.symbiosis.tonBridge(tonChainId, config.bridge)

        const { tokenAmountOut, ...result } = await this.doExactIn({
            tokenAmountIn,
            tokenOut: config.wTon,
            from,
            to: from,
            slippage,
            deadline,
        })

        let tonAmountOut = new TokenAmount(TON, tokenAmountOut.raw.toString())
        if (BigNumber.from(tonAmountOut.raw.toString()).lt(MIN_WTON_AMOUNT.toString())) {
            throw new Error(
                `Amount ${tonAmountOut.toSignificant()} less than fee ${tonAmountOut.toSignificant}`,
                ErrorCode.AMOUNT_LESS_THAN_FEE
            )
        }
        const bridgeFee = this.estimateBridgeFee(tokenAmountOut)
        tonAmountOut = tonAmountOut.subtract(bridgeFee)

        return {
            ...result,
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
            '0x331f40cc27aC106e1d5242CE633dc6436626a6F8', // FIXME
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

import { parseUnits } from '@ethersproject/units'
import { BigNumber } from 'ethers'
import TonWeb from 'tonweb'
import { BaseSwapping, CrosschainSwapExactInResult } from './baseSwapping'
import { Token, TokenAmount } from '../entities'
import { MulticallRouter, TonBridge } from './contracts'
import { ChainId } from '../constants'
import { Error, ErrorCode } from './error'
import { OneInchProtocols } from './trade/oneInchTrade'
import { AddressZero } from '@ethersproject/constants/lib/addresses'

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

const wTonAttributes = {
    decimals: TON_TOKEN_DECIMALS,
    name: 'Wrapped Toncoin',
    symbol: 'wTon',
    icons: {
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
    },
}
const CONFIG: { chainId: ChainId; bridge: string; wTon: Token }[] = [
    {
        chainId: ChainId.SEPOLIA_TESTNET,
        bridge: '0x3A1e6dA810637fb1c99fa0899b4F402A60E131D2',
        wTon: new Token({
            chainId: ChainId.SEPOLIA_TESTNET,
            address: '0x331f40cc27aC106e1d5242CE633dc6436626a6F8',
            ...wTonAttributes,
        }),
    },
    {
        chainId: ChainId.BSC_MAINNET,
        bridge: AddressZero,
        wTon: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x76A797A59Ba2C17726896976B7B3747BfD1d220f',
            ...wTonAttributes,
        }),
    },
    {
        chainId: ChainId.ETH_MAINNET,
        bridge: AddressZero,
        wTon: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1',
            ...wTonAttributes,
        }),
    },
]

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

    public async exactIn({
        tokenAmountIn,
        from,
        to,
        slippage,
        deadline,
    }: ZappingTonExactInParams): Promise<CrosschainSwapExactInResult> {
        // find suitable config for current env
        const options = CONFIG.filter((i) => {
            return this.symbiosis.config.chains.map((chain) => chain.id).find((chainId) => chainId === i.chainId)
        })
        const config = options[0] // select the first suitable
        if (!config) {
            throw new Error(`There are no suitable config options`)
        }

        this.from = from
        this.multicallRouter = this.symbiosis.multicallRouter(config.chainId)
        this.userAddress = to
        this.tonBridge = this.symbiosis.tonBridge(config.chainId, config.bridge)

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
            route: [...result.route, new Token({ ...config.wTon, chainId: ChainId.TON_MAINNET })], // add TON for display purposes only
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

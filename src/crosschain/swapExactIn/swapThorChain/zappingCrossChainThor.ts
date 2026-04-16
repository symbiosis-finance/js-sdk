import type { Token } from '../../../entities'
import { TokenAmount } from '../../../entities'
import { isEvmChainId } from '../../chainUtils'
import type { MulticallRouter } from '../../contracts'
import { ThorRouter__factory } from '../../contracts'
import { ThorChainError } from '../../sdkError'
import type { OneInchProtocols } from '../../trade/oneInchTrade'
import { SymbiosisTradeType } from '../../trade'
import type { Address, EvmAddress, SwapExactInResult } from '../../types'
import { BaseSwapping } from '../../swapping'

import type { ThorQuote } from './utils'
import { BTC, checkThorPool, getThorQuote, getThorVault, validateBitcoinAddress } from './utils'

interface ZappingThorExactInParams {
    tokenAmountIn: TokenAmount
    thorTokenIn: Token
    thorTokenOut: string
    from: Address
    to: Address
    slippage: number
    deadline: number
    partnerAddress?: EvmAddress
    fallbackReceiver?: EvmAddress
    oneInchProtocols?: OneInchProtocols
}

export class ZappingThor extends BaseSwapping {
    protected multicallRouter!: MulticallRouter
    protected bitcoinAddress!: string

    protected thorTokenIn!: Token
    protected thorTokenOut!: string
    protected thorVault!: string
    protected thorQuote!: ThorQuote
    protected evmTo!: Address

    protected async doPostTransitAction() {
        this.thorQuote = await getThorQuote({
            thorTokenIn: this.thorTokenIn,
            thorTokenOut: this.thorTokenOut,
            evmTo: this.evmTo,
            bitcoinAddress: this.bitcoinAddress,
            amount: this.transit.amountOut,
        })
    }

    public async exactIn({
        tokenAmountIn,
        thorTokenIn,
        thorTokenOut,
        from,
        to,
        slippage,
        deadline,
        partnerAddress,
        fallbackReceiver,
    }: ZappingThorExactInParams): Promise<SwapExactInResult> {
        validateBitcoinAddress(to)
        this.bitcoinAddress = to
        this.thorTokenIn = thorTokenIn
        this.thorTokenOut = thorTokenOut

        this.evmTo = from
        if (!isEvmChainId(tokenAmountIn.token.chainId)) {
            this.evmTo = fallbackReceiver ?? this.symbiosis.config.fallbackReceiver
        }

        // check if there is "Available" ThorChain pool at the moment
        await checkThorPool(this.symbiosis.cache, thorTokenIn)

        this.multicallRouter = this.symbiosis.multicallRouter(thorTokenIn.chainId)
        this.thorVault = await getThorVault(this.symbiosis.cache, thorTokenIn)

        const transitTokenIn = this.symbiosis.transitToken(tokenAmountIn.token.chainId, this.omniPoolConfig)
        const transitTokenOut = this.symbiosis.transitToken(thorTokenIn.chainId, this.omniPoolConfig)
        if (transitTokenIn.equals(transitTokenOut)) {
            throw new ThorChainError('Same transit token. Prefer on-chain swap')
        }

        const result = await this.doExactIn({
            tokenAmountIn,
            tokenOut: thorTokenIn,
            from,
            to: this.evmTo,
            slippage,
            deadline,
            transitTokenIn,
            transitTokenOut,
            partnerAddress,
            depositoryEnabled: false,
        })

        return {
            ...result,
            tokenAmountOut: this.thorQuote.amountOut,
            tokenAmountOutMin: this.thorQuote.amountOutMin,
            labels: [...result.labels, 'partner-swap' as const],
            routes: [
                ...result.routes,
                {
                    provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
                    tokens: [thorTokenIn, BTC],
                },
            ],
            fees: [
                ...result.fees,
                {
                    provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
                    description: 'THORChain fee',
                    value: new TokenAmount(BTC, this.thorQuote.fees.total),
                },
            ],
        }
    }

    protected tradeCTo(): Address {
        return this.multicallRouter.address as Address
    }

    protected finalReceiveSide(): Address {
        return this.multicallRouter.address as Address
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
        const amount = this.transit.amountOut

        if (this.tradeC) {
            callDatas.push(this.tradeC.callData)
            receiveSides.push(this.tradeC.routerAddress)
            path.push(this.tradeC.tokenAmountIn.token.address)
            offsets.push(this.tradeC.callDataOffset!)
        }

        const expiry = Math.floor(Date.now() / 1000) + 60 * 60 // + 1h
        const burnCalldata = ThorRouter__factory.createInterface().encodeFunctionData('depositWithExpiry', [
            this.thorVault,
            this.thorTokenIn.address,
            '0', // will be patched
            this.thorQuote.memo,
            expiry,
        ])

        callDatas.push(burnCalldata)
        receiveSides.push(this.thorQuote.router)
        path.push(this.thorTokenIn.address)
        offsets.push(100)

        return this.multicallRouter.interface.encodeFunctionData('multicall', [
            amount.raw.toString(),
            callDatas,
            receiveSides,
            path,
            offsets,
            this.evmTo,
        ])
    }
}

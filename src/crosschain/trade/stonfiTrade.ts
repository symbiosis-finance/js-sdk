import type { RouterInfo } from '@ston-fi/api'
import { StonApiClient } from '@ston-fi/api'
import { dexFactory } from '@ston-fi/sdk'
import type { BaseRouterV2_1 } from '@ston-fi/sdk/dist/contracts/dex/v2_1/router/BaseRouterV2_1'
import type { OpenedContract, SenderArguments } from '@ton/core'
import type { TonClient4 } from '@ton/ton'

import type { Token } from '../../entities'
import { Percent, TokenAmount } from '../../entities'
import { TON_REFERRAL_ADDRESS, TON_STONFI_PROXY_ADDRESS } from '../chainUtils'
import { StonFiTradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { TonAddress } from '../types'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

interface StonfiTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
    from: string
}

export class StonfiTrade extends SymbiosisTrade {
    public readonly symbiosis!: Symbiosis
    public readonly deadline!: number
    public readonly from!: string

    private readonly stonClient: StonApiClient
    private tonClient: TonClient4 | null = null
    private routerMetadata: RouterInfo | null = null
    private dexContracts: ReturnType<typeof dexFactory> | null = null
    private router: OpenedContract<BaseRouterV2_1> | null = null

    public constructor(params: StonfiTradeParams) {
        super(params)
        this.stonClient = new StonApiClient()
    }

    get tradeType(): SymbiosisTradeType {
        return 'stonfi'
    }

    public async init() {
        this.tonClient = await this.symbiosis.getTonClient()
        const quote = await this.stonClient.simulateSwap({
            offerAddress: this.tokenAmountIn.token.isNative
                ? TON_STONFI_PROXY_ADDRESS
                : this.tokenAmountIn.token.tonAddress,
            offerUnits: this.tokenAmountIn.raw.toString(),
            askAddress: this.tokenOut.isNative ? TON_STONFI_PROXY_ADDRESS : this.tokenOut.tonAddress,
            slippageTolerance: (this.slippage / 10000).toString(), // 0.01 is 1%
        })
        await this.initRouterAndContracts(quote.routerAddress)
        const txParams = await this.buildCalldata(this.tokenAmountIn, this.tokenOut, quote.minAskUnits)

        if (!txParams) {
            throw new StonFiTradeError('Failed to build TON swap')
        }

        const amountOut = new TokenAmount(this.tokenOut, quote.askUnits)
        const amountOutMin = new TokenAmount(this.tokenOut, quote.minAskUnits)

        const priceImpact = new Percent(BigInt(Math.ceil(-quote.priceImpact * 10000)), '10000')

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact,
            routerAddress: txParams.to.toString() as TonAddress,
            callData: txParams.body?.toBoc().toString('base64') ?? '',
            callDataOffset: 0,
            minReceivedOffset: 0,
            value: txParams.value,
            fees: [
                {
                    provider: 'stonfi',
                    description: 'Stonfi fee',
                    value: new TokenAmount(this.tokenOut, quote.feeUnits),
                },
            ],
        }

        return this
    }

    private async initRouterAndContracts(routerAddress: string) {
        const metadata = await this.stonClient.getRouter(routerAddress)
        this.routerMetadata = metadata
        this.dexContracts = dexFactory(metadata)

        if (!this.dexContracts) {
            throw new StonFiTradeError('Failed to get dex contracts')
        }
        const routerContract = this.dexContracts.Router.create(metadata.address)
        this.router = this.tonClient!.open(routerContract) as OpenedContract<BaseRouterV2_1>
    }

    public async buildCalldata(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        minAskUnits: string
    ): Promise<SenderArguments | null> {
        if (!this.router || !this.dexContracts || !this.routerMetadata) {
            throw new StonFiTradeError('Trade is not initialized')
        }

        const queryId = Math.floor(Math.random() * 100_000)
        const referralParams = {
            referralAddress: TON_REFERRAL_ADDRESS,
            referralValue: 25, // 0.25%
            queryId,
        }

        if (tokenAmountIn.token.isNative) {
            // TON -> jetton
            return this.router.getSwapTonToJettonTxParams({
                userWalletAddress: this.from,
                proxyTon: this.dexContracts.pTON.create(this.routerMetadata.ptonMasterAddress),
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: tokenOut.tonAddress,
                minAskAmount: minAskUnits,
                ...referralParams,
            })
        } else if (tokenOut.isNative) {
            // jetton -> TON
            return this.router.getSwapJettonToTonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: tokenAmountIn.token.tonAddress,
                offerAmount: tokenAmountIn.raw.toString(),
                minAskAmount: minAskUnits,
                proxyTon: this.dexContracts.pTON.create(this.routerMetadata.ptonMasterAddress),
                ...referralParams,
            })
        } else {
            // jetton -> jetton
            return this.router.getSwapJettonToJettonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: tokenAmountIn.token.tonAddress,
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: tokenOut.tonAddress,
                minAskAmount: minAskUnits,
                ...referralParams,
            })
        }
    }
}

import { DEX, pTON } from '@ston-fi/sdk'
import { StonApiClient } from '@ston-fi/api'
import { SenderArguments } from '@ton/core'

import { Percent, Token, TokenAmount } from '../../entities'
import { isTonEvmAddress, TON_REFERRAL_ADDRESS, TON_STONFI_PROXY_ADDRESS } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

interface StonfiTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    deadline: number
    from: string
}

export class StonfiTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    public readonly deadline: number
    public readonly from: string
    private readonly stonClient: StonApiClient

    public constructor(params: StonfiTradeParams) {
        super(params)

        const { symbiosis, deadline, from } = params

        this.symbiosis = symbiosis
        this.deadline = deadline
        this.from = from

        this.stonClient = new StonApiClient()
    }

    get tradeType(): SymbiosisTradeType {
        return 'stonfi'
    }

    public async init() {
        if (!isTonEvmAddress(this.tokenAmountIn.token.address) && !this.tokenAmountIn.token.attributes?.ton) {
            throw new Error(`No TON token address for token ${this.tokenAmountIn.token.symbol}`)
        }

        if (!isTonEvmAddress(this.tokenOut.address) && !this.tokenOut.attributes?.ton) {
            throw new Error(`No TON token address for token ${this.tokenOut.symbol}`)
        }

        const quote = await this.stonClient.simulateSwap({
            offerAddress: isTonEvmAddress(this.tokenAmountIn.token.address)
                ? TON_STONFI_PROXY_ADDRESS
                : this.tokenAmountIn.token.attributes!.ton!,
            offerUnits: this.tokenAmountIn.raw.toString(),
            askAddress: isTonEvmAddress(this.tokenOut.address)
                ? TON_STONFI_PROXY_ADDRESS
                : this.tokenOut.attributes!.ton!,
            slippageTolerance: (this.slippage / 10000).toString(), // 0.01 is 1%
        })

        const txParams = await this.buildCalldata(this.tokenAmountIn, this.tokenOut, quote.minAskUnits)

        const amountOut = new TokenAmount(this.tokenOut, quote.askUnits)
        const amountOutMin = new TokenAmount(this.tokenOut, quote.minAskUnits)

        if (!txParams) {
            throw new Error('Failed to build TON swap via Stonfi DEX')
        }

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact: new Percent(BigInt(Math.ceil(-quote.priceImpact * 10000)), '10000'),
            routerAddress: txParams?.to.toString() ?? '',
            callData: txParams?.body?.toBoc().toString('base64') ?? '',
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

    public async buildCalldata(
        tokenAmountIn: TokenAmount,
        tokenOut: Token,
        minAskUnits: string
    ): Promise<SenderArguments | null> {
        const client = await this.symbiosis.getTonClient()
        const router = client.open(new DEX.v1.Router())
        const queryId = Math.floor(Math.random() * 100_000)

        const proxyTon = new pTON.v1()

        let txParams: SenderArguments | null = null

        if (!isTonEvmAddress(tokenAmountIn.token.address) && !tokenAmountIn.token.attributes?.ton) {
            throw new Error(`No TON token address for token ${tokenAmountIn.token.symbol}`)
        }

        if (!isTonEvmAddress(tokenOut.address) && !tokenOut.attributes?.ton) {
            throw new Error(`No TON token address for token ${tokenOut.symbol}`)
        }

        // TON -> jetton
        if (isTonEvmAddress(tokenAmountIn.token.address)) {
            txParams = await router.getSwapTonToJettonTxParams({
                userWalletAddress: this.from,
                proxyTon: proxyTon,
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: tokenOut.attributes!.ton!,
                minAskAmount: minAskUnits,
                referralAddress: TON_REFERRAL_ADDRESS,
                queryId,
            })
        } else if (isTonEvmAddress(tokenOut.address)) {
            // jetton -> TON
            txParams = await router.getSwapJettonToTonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: tokenAmountIn.token.attributes!.ton!,
                offerAmount: tokenAmountIn.raw.toString(),
                minAskAmount: minAskUnits,
                referralAddress: TON_REFERRAL_ADDRESS,
                proxyTon,
                queryId,
            })
        } else {
            // jetton -> jetton
            txParams = await router.getSwapJettonToJettonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: tokenAmountIn.token.attributes!.ton!,
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: tokenOut.attributes!.ton!,
                minAskAmount: minAskUnits,
                referralAddress: TON_REFERRAL_ADDRESS,
                queryId,
            })
        }

        return txParams
    }
}

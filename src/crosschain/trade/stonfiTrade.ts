import { DEX, pTON } from '@ston-fi/sdk'
import { StonApiClient } from '@ston-fi/api'
import { SenderArguments } from '@ton/core'

import { Percent, Token, TokenAmount } from '../../entities'
import { getTonTokenAddress, TON_EVM_ADDRESS } from '../chainUtils'
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
        const quote = await this.stonClient.simulateSwap({
            offerAddress: getTonTokenAddress(this.tokenAmountIn.token.address, true),
            offerUnits: this.tokenAmountIn.raw.toString(),
            askAddress: getTonTokenAddress(this.tokenOut.address, true),
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

        // TON -> jetton
        if (tokenAmountIn.token.address === TON_EVM_ADDRESS) {
            txParams = await router.getSwapTonToJettonTxParams({
                userWalletAddress: this.from,
                proxyTon: proxyTon,
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: getTonTokenAddress(tokenOut.address),
                minAskAmount: minAskUnits,
                queryId,
            })
        } else if (tokenOut.address === TON_EVM_ADDRESS) {
            // jetton -> TON
            txParams = await router.getSwapJettonToTonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: getTonTokenAddress(tokenAmountIn.token.address),
                offerAmount: tokenAmountIn.raw.toString(),
                minAskAmount: minAskUnits,
                proxyTon,
                queryId,
            })
        } else {
            // jetton -> jetton
            txParams = await router.getSwapJettonToJettonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: getTonTokenAddress(tokenAmountIn.token.address),
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: getTonTokenAddress(tokenOut.address),
                minAskAmount: minAskUnits,
                queryId,
            })
        }

        return txParams
    }
}

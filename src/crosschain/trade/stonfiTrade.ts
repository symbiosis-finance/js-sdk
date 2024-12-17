import { DEX, pTON } from '@ston-fi/sdk'
import { SenderArguments } from '@ton/core'

import { Token, TokenAmount } from '../../entities'
import { calculatePriceImpact, getTonTokenAddress, TON_EVM_ADDRESS } from '../chainUtils'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { StonApiClient } from '@ston-fi/api'

interface StonfiTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
    tokenAmountInMin: TokenAmount
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
        const txParams = await this.quote(this.tokenAmountIn, this.tokenOut)

        const quote = await this.stonClient.simulateSwap({
            offerAddress: getTonTokenAddress(this.tokenAmountIn.token.address),
            offerUnits: this.tokenAmountIn.raw.toString(),
            askAddress: getTonTokenAddress(this.tokenOut.address),
            slippageTolerance: this.slippage.toString(), // 0.01 is 1%
        })

        console.log('quote', quote)

        const amountOut = new TokenAmount(this.tokenOut, quote.swapRate)
        const priceImpact = calculatePriceImpact(this.tokenAmountIn, amountOut)

        this.out = {
            amountOut,
            amountOutMin: amountOut,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact,
            routerAddress: txParams.to.toString(),
            callData: txParams.body?.toBoc().toString('base64') ?? '',
            callDataOffset: 0,
            minReceivedOffset: 0,
        }

        return this
    }

    public async quote(tokenAmountIn: TokenAmount, tokenOut: Token): Promise<SenderArguments> {
        const client = await this.symbiosis.getTonClient()
        const router = client.open(
            DEX.v2_1.Router.create(
                'kQALh-JBBIKK7gr0o4AVf9JZnEsFndqO0qTCyT-D-yBsWk0v' // CPI Router v2.1.0
            )
        )
        const queryId = Math.floor(Math.random() * 100_000)

        const proxyTon = pTON.v2_1.create(
            'kQACS30DNoUQ7NfApPvzh7eBmSZ9L4ygJ-lkNWtba8TQT-Px' // pTON v2.1.0
        )

        let txParams: SenderArguments

        // TON -> jetton
        if (tokenAmountIn.token.address === TON_EVM_ADDRESS) {
            txParams = await router.getSwapTonToJettonTxParams({
                userWalletAddress: this.from,
                proxyTon: proxyTon,
                offerAmount: tokenAmountIn.raw.toString(),
                askJettonAddress: getTonTokenAddress(tokenOut.address),
                minAskAmount: '1', // [TODO]: get min amount
                queryId,
            })
        } else if (tokenOut.address === TON_EVM_ADDRESS) {
            // jetton -> TON
            txParams = await router.getSwapJettonToTonTxParams({
                userWalletAddress: this.from,
                offerJettonAddress: getTonTokenAddress(tokenAmountIn.token.address),
                offerAmount: tokenAmountIn.raw.toString(),
                minAskAmount: '1', // [TODO]: get min amount
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
                minAskAmount: '1', // [TODO]: get min amount
                queryId,
            })
        }

        return txParams
    }
}

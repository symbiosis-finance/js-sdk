import { NATIVE_MINT } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'

import { Percent, TokenAmount } from '../../entities'
import { JupiterTradeError } from '../sdkError'
import type { Symbiosis } from '../symbiosis'
import type { SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { SymbiosisTrade } from './symbiosisTrade'

interface JupiterTradeParams extends SymbiosisTradeParams {
    symbiosis: Symbiosis
}

interface JupiterQuoteResponse {
    inputMint: string
    inAmount: string
    outputMint: string
    outAmount: string
    otherAmountThreshold: string
    swapMode: 'ExactIn'
    slippageBps: number
    platformFee: null | unknown
    priceImpactPct: string
    routePlan: {
        swapInfo: {
            ammKey: string
            label: string
            inputMint: string
            outputMint: string
            inAmount: string
            outAmount: string
            feeAmount: string
            feeMint: string
        }
        percent: number
    }[]
    contextSlot: number
    timeTaken: number
}

interface JupiterSwapResponse {
    swapTransaction: string
    lastValidBlockHeight: number
    prioritizationFeeLamports: number
    computeUnitLimit: number
    prioritizationType: {
        computeBudget: {
            microLamports: number
            estimatedMicroLamports: number
        }
    }
    dynamicSlippageReport: {
        slippageBps: number
        otherAmount: number
        simulatedIncurredSlippageBps: number
        amplificationRatio: string
        categoryName: string
        heuristicMaxSlippageBps: number
    }
    simulationError: null | string
}

const JUPITER_API_URL = 'https://lite-api.jup.ag/swap/v1'

export class JupiterTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    private solanaToPubKey: PublicKey

    public constructor(params: JupiterTradeParams) {
        super(params)
        this.symbiosis = params.symbiosis
        this.solanaToPubKey = new PublicKey(params.to)
    }

    get tradeType(): SymbiosisTradeType {
        return 'jupiter'
    }

    public async init() {
        const inputMint = this.tokenAmountIn.token.isNative
            ? NATIVE_MINT.toBase58()
            : this.tokenAmountIn.token.solAddress
        const outputMint = this.tokenOut.isNative ? NATIVE_MINT.toBase58() : this.tokenOut.solAddress

        // get quote
        const quoteResponse = (await fetch(
            `${JUPITER_API_URL}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${this.tokenAmountIn.raw.toString()}&slippageBps=${
                this.slippage
            }&restrictIntermediateTokens=true`
        ).then((res) => res.json())) as JupiterQuoteResponse

        if (!quoteResponse?.outAmount) {
            throw new JupiterTradeError('Failed to get quote')
        }

        const instructionsResponse = await this.buildInstructions(quoteResponse)

        const amountOut = new TokenAmount(this.tokenOut, quoteResponse.outAmount)
        const amountOutMin = new TokenAmount(this.tokenOut, quoteResponse.otherAmountThreshold)

        const priceImpact = new Percent(
            BigInt(+Number(quoteResponse.priceImpactPct).toFixed(4) * -10000),
            BigInt(10000)
        )

        this.out = {
            amountOut,
            amountOutMin,
            route: [this.tokenAmountIn.token, this.tokenOut],
            priceImpact,
            routerAddress: '',
            callData: '',
            callDataOffset: 0,
            minReceivedOffset: 0,
            instructions: instructionsResponse.swapTransaction,
        }

        return this
    }

    async buildInstructions(quoteResponse: JupiterQuoteResponse) {
        const swapResponse = (await (
            await fetch(`${JUPITER_API_URL}/swap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: this.solanaToPubKey.toBase58(),

                    prioritizationFeeLamports: {
                        priorityLevelWithMaxLamports: {
                            maxLamports: 10_000_000, // 0.01 SOL
                            priorityLevel: 'high',
                        },
                    },
                }),
            })
        ).json()) as JupiterSwapResponse

        return swapResponse
    }
}

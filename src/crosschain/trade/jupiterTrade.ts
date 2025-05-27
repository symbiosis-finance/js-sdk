import { PublicKey } from '@solana/web3.js'
import { NATIVE_MINT } from '@solana/spl-token'

import { Percent, TokenAmount } from '../../entities'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'

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

const JUPITER_API_URL = 'https://api.jup.ag/swap/v1'

export class JupiterTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    private solanaToPubKey: PublicKey

    public constructor(params: JupiterTradeParams) {
        super(params)

        const { symbiosis, to } = params

        this.symbiosis = symbiosis
        this.solanaToPubKey = new PublicKey(to)
    }

    get tradeType(): SymbiosisTradeType {
        return 'jupiter'
    }

    public async init() {
        try {
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
                throw new Error('Failed to get quote via jupiter dex')
            }

            const instructionsResponse = await this.buildInstructions(quoteResponse)

            const amountOut = new TokenAmount(this.tokenOut, quoteResponse.outAmount)
            const amountOutMin = new TokenAmount(this.tokenOut, quoteResponse.otherAmountThreshold)

            this.out = {
                amountOut,
                amountOutMin,
                route: [this.tokenAmountIn.token, this.tokenOut],
                priceImpact: new Percent(
                    BigInt(+Number(quoteResponse.priceImpactPct).toFixed(4) * -10000),
                    BigInt(10000)
                ),
                routerAddress: '',
                callData: '',
                callDataOffset: 0,
                minReceivedOffset: 0,
                instructions: instructionsResponse.swapTransaction,
            }

            return this
        } catch (err) {
            console.log('Failed to swap via Jupiter', err)
            throw err
        }
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

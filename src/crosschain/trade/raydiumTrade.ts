import { PublicKey } from '@solana/web3.js'
import { ApiSwapV1Out, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { Percent, TokenAmount } from '../../entities'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getSolanaConnection } from '../chainUtils'

interface RaydiumTradeParams extends SymbiosisTradeParams {
    from: string
    symbiosis: Symbiosis
}

interface PriorityFeeResponse {
    id: string
    success: boolean
    data: {
        default: {
            vh: number // very high
            h: number // high
            m: number // medium
        }
    }
}

interface SwapTransactionsResponse {
    id: string
    version: string
    success: boolean
    data: { transaction: string }[]
}

interface BuildSwapInstructionsParams {
    inputMint: string
    outputMint: string
    txVersion: string
    quoteResponse: ApiSwapV1Out
}

export class RaydiumTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    private solanaToPubkey: PublicKey

    public constructor(params: RaydiumTradeParams) {
        super(params)

        const { symbiosis, to } = params

        this.symbiosis = symbiosis
        this.solanaToPubkey = new PublicKey(to)
    }

    get tradeType(): SymbiosisTradeType {
        return 'raydium'
    }

    public async init() {
        const txVersion = 'V0' // could be 'LEGACY' or 'V0'

        try {
            const inputMint = this.tokenAmountIn.token.isNative
                ? NATIVE_MINT.toBase58()
                : this.tokenAmountIn.token.attributes?.solana
            const outputMint = this.tokenOut.isNative ? NATIVE_MINT.toBase58() : this.tokenOut.attributes?.solana

            if (!inputMint || !outputMint) {
                throw new Error('Solana address not found')
            }

            // get quote
            const quoteResponse = (await fetch(
                `${
                    API_URLS.SWAP_HOST
                }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${this.tokenAmountIn.raw.toString()}&slippageBps=${
                    this.slippage
                }&txVersion=${txVersion}`
            ).then((res) => res.json())) as ApiSwapV1Out

            if (!quoteResponse.success) {
                throw new Error('Failed to get quote via raydium dex')
            }

            const instructionsResponse = await this.buildInstructions({
                inputMint,
                outputMint,
                txVersion,
                quoteResponse,
            })

            const amountOut = new TokenAmount(this.tokenOut, quoteResponse.data.outputAmount)
            const amountOutMin = new TokenAmount(this.tokenOut, quoteResponse.data.otherAmountThreshold)

            this.out = {
                amountOut,
                amountOutMin,
                route: [this.tokenAmountIn.token, this.tokenOut],
                priceImpact: new Percent(BigInt(quoteResponse.data.priceImpactPct * -100), BigInt(10000)),
                routerAddress: '',
                callData: '',
                callDataOffset: 0,
                minReceivedOffset: 0,
                instructions: instructionsResponse[0], // all instructions will be in the first array element
            }

            return this
        } catch (err) {
            console.log('Failed to swap via Raydium', err)
            throw err
        }
    }

    async buildInstructions({ inputMint, outputMint, txVersion, quoteResponse }: BuildSwapInstructionsParams) {
        const isInputSol = this.tokenAmountIn.token.isNative
        const isOutputSol = this.tokenOut.isNative

        const priorityFee = (await fetch(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`).then((res) =>
            res.json()
        )) as PriorityFeeResponse

        const { tokenAccounts: tokenAccountsFrom } = await this.fetchTokenAccountData(this.solanaToPubkey)

        const inputTokenAcc = tokenAccountsFrom.find((a) => a.mint.toBase58() === inputMint)?.publicKey
        const outputTokenAcc = tokenAccountsFrom.find((a) => a.mint.toBase58() === outputMint)?.publicKey

        if (!inputTokenAcc && !isInputSol) {
            console.error(
                `Raydium swap. Do not have input token account for ${this.tokenAmountIn.token.symbol} ${inputMint}`
            )
            return []
        }

        const swapTransactions = (await fetch(`${API_URLS.SWAP_HOST}/transaction/swap-base-in`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                computeUnitPriceMicroLamports: String(priorityFee.data.default.h),
                swapResponse: quoteResponse,
                txVersion,
                wallet: this.solanaToPubkey,
                wrapSol: isInputSol,
                unwrapSol: isOutputSol,
                inputAccount: isInputSol ? undefined : inputTokenAcc,
                outputAccount: isOutputSol ? undefined : outputTokenAcc,
            }),
        }).then((res) => res.json())) as SwapTransactionsResponse

        return swapTransactions.data.map((tx) => tx.transaction)
    }

    async fetchTokenAccountData(publicKey: PublicKey) {
        const connection = getSolanaConnection()
        const [solAccountResp, tokenAccountResp, token2022Resp] = await Promise.all([
            connection.getAccountInfo(publicKey),
            connection.getTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID,
            }),
            connection.getTokenAccountsByOwner(publicKey, {
                programId: TOKEN_2022_PROGRAM_ID,
            }),
        ])
        const tokenAccountData = parseTokenAccountResp({
            owner: publicKey,
            solAccountResp,
            tokenAccountResp: {
                context: tokenAccountResp.context,
                value: [...tokenAccountResp.value, ...token2022Resp.value],
            },
        })
        return tokenAccountData
    }
}

import { PublicKey } from '@solana/web3.js'
import { ApiSwapV1Out, parseTokenAccountResp } from '@raydium-io/raydium-sdk-v2'
import { API_URLS } from '@raydium-io/raydium-sdk-v2'
import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

import { Percent, TokenAmount } from '../../entities'
import { Symbiosis } from '../symbiosis'
import { SymbiosisTrade, SymbiosisTradeParams, SymbiosisTradeType } from './symbiosisTrade'
import { getSolanaConnection, getSolanaTokenAddress } from '../chainUtils'

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

export class RaydiumTrade extends SymbiosisTrade {
    public readonly symbiosis: Symbiosis
    private solanaPubkey: PublicKey

    public constructor(params: RaydiumTradeParams) {
        super(params)

        const { symbiosis, from } = params

        this.symbiosis = symbiosis
        this.solanaPubkey = new PublicKey(from)
    }

    get tradeType(): SymbiosisTradeType {
        return 'raydium'
    }

    public async init() {
        const txVersion = 'V0' // could be 'LEGACY' or 'V0'

        try {
            const inputMint = this.tokenAmountIn.token.isNative
                ? NATIVE_MINT.toBase58()
                : getSolanaTokenAddress(this.tokenAmountIn.token.address)
            const outputMint = this.tokenOut.isNative
                ? NATIVE_MINT.toBase58()
                : getSolanaTokenAddress(this.tokenOut.address)

            // get quote
            const swapResponse = (await fetch(
                `${
                    API_URLS.SWAP_HOST
                }/compute/swap-base-in?inputMint=${inputMint}&outputMint=${outputMint}&amount=${this.tokenAmountIn.raw.toString()}&slippageBps=${
                    this.slippage
                }&txVersion=${txVersion}`
            ).then((res) => res.json())) as ApiSwapV1Out

            if (!swapResponse.success) {
                throw new Error('Failed to get quote via raydium dex')
            }

            const instructionsResponse = await this.buildCalldata({
                inputMint,
                outputMint,
                txVersion,
                swapResponse,
            })

            const amountOut = new TokenAmount(this.tokenOut, swapResponse.data.outputAmount)
            const amountOutMin = new TokenAmount(this.tokenOut, swapResponse.data.otherAmountThreshold)

            this.out = {
                amountOut,
                amountOutMin,
                route: [this.tokenAmountIn.token, this.tokenOut],
                priceImpact: new Percent(BigInt(swapResponse.data.priceImpactPct * -100), BigInt(10000)),
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

    async buildCalldata({
        inputMint,
        outputMint,
        txVersion,
        swapResponse,
    }: {
        inputMint: string
        outputMint: string
        txVersion: string
        swapResponse: ApiSwapV1Out
    }) {
        const isInputSol = this.tokenAmountIn.token.isNative
        const isOutputSol = this.tokenOut.isNative

        const priorityFee = (await fetch(`${API_URLS.BASE_HOST}${API_URLS.PRIORITY_FEE}`).then((res) =>
            res.json()
        )) as PriorityFeeResponse

        const { tokenAccounts } = await this.fetchTokenAccountData(this.solanaPubkey)

        const inputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === inputMint)?.publicKey
        const outputTokenAcc = tokenAccounts.find((a) => a.mint.toBase58() === outputMint)?.publicKey

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
                swapResponse,
                txVersion,
                wallet: this.solanaPubkey,
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
        const solAccountResp = await connection.getAccountInfo(publicKey)
        const tokenAccountResp = await connection.getTokenAccountsByOwner(publicKey, {
            programId: TOKEN_PROGRAM_ID,
        })
        const token2022Req = await connection.getTokenAccountsByOwner(publicKey, {
            programId: TOKEN_2022_PROGRAM_ID,
        })
        const tokenAccountData = parseTokenAccountResp({
            owner: publicKey,
            solAccountResp,
            tokenAccountResp: {
                context: tokenAccountResp.context,
                value: [...tokenAccountResp.value, ...token2022Req.value],
            },
        })
        return tokenAccountData
    }
}

import type { TransactionRequest } from '@ethersproject/providers'

import { Percent } from '../../entities'
import { isEvmChainId } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { buildDepositData } from '../intent'
import { SolverService } from '../solver'
import { TradeProvider } from '../trade'
import type { EvmAddress, SwapExactInParams, SwapExactInResult } from '../types'

export function isIntentSwapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, symbiosis } = params

    const srcChainId = tokenAmountIn.token.chainId
    const dstChainId = tokenOut.chainId

    if (!isEvmChainId(srcChainId) || !isEvmChainId(dstChainId)) {
        return false
    }

    // Must be a cross-chain swap
    if (srcChainId === dstChainId) {
        return false
    }

    return !!symbiosis.chainConfig(srcChainId).intentConfig && !!symbiosis.chainConfig(dstChainId).intentConfig
}

/**
 * Intent-based cross-chain swap via DepositorySrc.
 *
 * Flow:
 *  1. Ask the solver for a quote (tokenIn + amount → amountOut on dest chain).
 *  2. Build a DepositorySrc.deposit() transaction that locks tokenIn on the source chain.
 *  3. Return the transaction to the caller — user signs it to initiate the intent.
 *  4. The solver monitors IntentLocked events and calls fill() on the destination chain.
 */
export async function intentSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, from, to, symbiosis } = params

    const srcChainId = tokenAmountIn.token.chainId
    const dstChainId = tokenOut.chainId
    const srcIntentConfig = symbiosis.chainConfig(srcChainId).intentConfig!
    const dstIntentConfig = symbiosis.chainConfig(dstChainId).intentConfig!

    // Step 1: get a quote from the solver
    const solverUrl = symbiosis.config.solver?.url
    if (!solverUrl) {
        throw new Error('solver.url is not configured')
    }
    const solver = new SolverService(solverUrl)
    const { amountOut, quoteTTL, fee } = await solver.quote({
        tokenAmountIn,
        tokenOut,
    })

    // Step 2: build deposit() calldata
    // directUnlocker is on the dst chain
    // settlementUnlocker is on the src chain
    const data = buildDepositData({
        tokenAmountIn,
        amountOut,
        from: from as EvmAddress,
        to: to as EvmAddress,
        quoteTTL,
        directUnlockerAddress: dstIntentConfig.directUnlocker,
        settlementUnlockerAddress: srcIntentConfig.settlementUnlocker,
        srcChainId,
        dstChainId,
    })

    const transactionRequest: TransactionRequest = {
        to: srcIntentConfig.depositorySrc,
        data,
        value: '0x0',
        chainId: srcChainId,
    }

    return {
        transactionType: 'evm',
        transactionRequest,
        operationType: 'intent-swap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        priceImpact: new Percent('0', BIPS_BASE),
        approveTo: srcIntentConfig.depositorySrc,
        routes: [
            {
                provider: TradeProvider.INTENT_SOLVER,
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [
            {
                provider: TradeProvider.INTENT_SOLVER,
                value: fee,
                description: 'Solver fee',
            },
        ],
        labels: ['intent'],
    }
}

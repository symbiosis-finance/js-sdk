import type { TransactionRequest } from '@ethersproject/providers'

import type { ChainId } from '../../constants'
import { Percent } from '../../entities'
import { isEvmChainId } from '../chainUtils'
import { BIPS_BASE } from '../constants'
import { buildDepositV3Data } from '../depositoryV3'
import { SolverService } from '../solver'
import { SymbiosisTradeType } from '../trade'
import type { EvmAddress, SwapExactInParams, SwapExactInResult } from '../types'

export function isDepositoryV3SwapSupported(params: SwapExactInParams): boolean {
    const { tokenAmountIn, tokenOut, symbiosis } = params

    const srcChainId = tokenAmountIn.token.chainId
    if (!isEvmChainId(srcChainId)) {
        return false
    }

    // Must be a cross-chain swap
    if (srcChainId === tokenOut.chainId) {
        return false
    }

    return !!symbiosis.chainConfig(srcChainId).depositoryV3
}

/**
 * Intent-based cross-chain swap via DepositoryV3.
 *
 * Flow:
 *  1. Ask the solver for a quote (tokenIn + amount → amountOut on dest chain).
 *  2. Build a DepositoryV3.deposit() transaction that locks tokenIn on the source chain.
 *  3. Return the transaction to the caller — user signs it to initiate the intent.
 *  4. The solver monitors IntentLocked events and calls fill() on the destination chain.
 */
export async function depositoryV3Swap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, from, to, symbiosis } = params

    const srcChainId = tokenAmountIn.token.chainId as ChainId
    const depositoryV3Config = symbiosis.chainConfig(srcChainId).depositoryV3!

    // Step 1: get a quote from the solver
    const solver = new SolverService(depositoryV3Config.solverUrl)
    const { amountOut, quoteTTL } = await solver.quote({
        tokenIn: tokenAmountIn.token,
        amountIn: tokenAmountIn,
        tokenOut,
    })

    // Step 2: build deposit() calldata
    const callData = buildDepositV3Data({
        tokenAmountIn,
        amountOut,
        from: from as EvmAddress,
        to: to as EvmAddress,
        quoteTTL,
        directUnlockerAddress: depositoryV3Config.directUnlocker,
        settlementUnlockerAddress: depositoryV3Config.settlementUnlocker,
        srcChainId,
        dstChainId: tokenOut.chainId,
    })

    const transactionRequest: TransactionRequest = {
        to: depositoryV3Config.depository,
        data: callData,
        value: '0x0',
        chainId: srcChainId,
    }

    return {
        transactionType: 'evm',
        transactionRequest,
        kind: 'crosschain-swap',
        tokenAmountOut: amountOut,
        tokenAmountOutMin: amountOut,
        priceImpact: new Percent('0', BIPS_BASE),
        approveTo: depositoryV3Config.depository,
        routes: [
            {
                provider: SymbiosisTradeType.SYMBIOSIS,
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [],
        labels: ['intent'],
    }
}

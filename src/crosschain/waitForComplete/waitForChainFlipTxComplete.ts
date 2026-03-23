import { SwapSDK } from '@chainflip/sdk/swap'

import { longPolling } from './utils'

class WaitForChainFlipTxCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForChainFlipTxCompleteError'
    }
}

export interface WaitForChainFlipTxCompleteParams {
    txHash: string
}

/**
 * Polls Chainflip API until a vault swap transaction is completed or refunded/failed.
 *
 * Terminal states (both return state === 'COMPLETED' from the API):
 *   - Success:  swapEgress.txRef is present → returns destination chain tx ref
 *   - Refund:   swapEgress is absent, refundEgress is present → throws error
 *
 * @param txHash - Solana transaction signature submitted to the Chainflip vault
 * @returns Destination chain transaction reference from Chainflip egress
 */
export async function waitForChainFlipTxComplete({ txHash }: WaitForChainFlipTxCompleteParams): Promise<string> {
    const chainFlipSdk = new SwapSDK({ network: 'mainnet' })

    const result = await longPolling<{ completed: boolean; txHash?: string; error?: string }>({
        pollingFunction: async () => {
            const status = await chainFlipSdk.getStatusV2({ id: txHash })

            if (status.state === 'COMPLETED' || status.state === 'FAILED') {
                const swapTxRef = status.swapEgress?.txRef

                if (swapTxRef) {
                    return { completed: true, txHash: swapTxRef }
                }

                // Swap was aborted and refunded — no destination tx
                const abortReason =
                    'regular' in status.swap
                        ? (status.swap.regular as { abortedReason?: string }).abortedReason
                        : undefined
                const error =
                    abortReason ??
                    status.swapEgress?.failure?.reason?.message ??
                    status.refundEgress?.failure?.reason?.message ??
                    'swap was refunded'
                return { completed: true, error: error }
            }

            return { completed: false }
        },
        successCondition: (r) => r.completed,
        error: new WaitForChainFlipTxCompleteError(`ChainFlip swap tracking timed out for tx: ${txHash}`),
    })

    if (result.error !== undefined || result.txHash === undefined) {
        throw new WaitForChainFlipTxCompleteError(`ChainFlip swap did not complete: ${result.error}`)
    }

    return result.txHash
}

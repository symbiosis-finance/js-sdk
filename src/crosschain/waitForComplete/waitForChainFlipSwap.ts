import type { TransactionReceipt } from '@ethersproject/providers'
import type { SwapStatusResponseV2 } from '@chainflip/sdk/swap'
import { SwapSDK } from '@chainflip/sdk/swap'

import type { ChainId } from '../../constants'
import { CHAIN_FLIP_TOKENS } from '../swapExactIn'
import type { WaitForCompleteResult } from './types'
import { longPolling } from './utils'

const SWAP_TOKEN_TOPIC0 = '0x834b524d9f8ccbd31b00b671c896697b96eb4398c0f56e9386a21f5df61e3ce3'

function chainFlipChainToChainId(chain: string): ChainId | undefined {
    return CHAIN_FLIP_TOKENS.find((token) => token.chain === chain)?.token.chainId
}

function findChainFlipSwap(receipt: TransactionReceipt) {
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === SWAP_TOKEN_TOPIC0
    })

    return !!log
}

class WaitForChainFlipError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForChainFlipError'
    }
}

export async function waitForChainFlipSwap(receipt: TransactionReceipt): Promise<WaitForCompleteResult | undefined> {
    const found = findChainFlipSwap(receipt)
    if (!found) {
        return
    }

    return waitForChainFlipTxComplete(receipt.transactionHash)
}

export async function waitForChainFlipTxComplete(txHash: string): Promise<WaitForCompleteResult> {
    const chainFlipSdk = new SwapSDK({ network: 'mainnet' })

    const response = await longPolling<SwapStatusResponseV2>({
        pollingFunction: async () => {
            return chainFlipSdk.getStatusV2({ id: txHash })
        },
        successCondition: (response) => {
            return response.state === 'COMPLETED' || response.state === 'FAILED'
        },
        error: new WaitForChainFlipError(`ChainFlip swap tracking timed out for tx: ${txHash}`),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10_000, // 10 seconds
    })

    if (response.state !== 'COMPLETED' && response.state !== 'FAILED') {
        throw new WaitForChainFlipError(`Unknown ChainFlip response state: ${response.state}`)
    }

    const swapTxRef = response.swapEgress?.txRef
    if (swapTxRef) {
        const chainId = chainFlipChainToChainId(response.destChain)
        if (!chainId) {
            throw new WaitForChainFlipError(`Unknown ChainFlip destination chain: ${response.destChain}`)
        }
        return {
            txHash: swapTxRef,
            chainId,
        }
    }

    // Swap was aborted and refunded — return refund tx
    const refundTxRef = response.refundEgress?.txRef
    if (refundTxRef) {
        const refundChainId = chainFlipChainToChainId(response.srcChain)
        if (!refundChainId) {
            throw new WaitForChainFlipError(`Unknown ChainFlip source chain: ${response.srcChain}`)
        }
        return {
            txHash: refundTxRef,
            chainId: refundChainId,
        }
    }

    throw new WaitForChainFlipError(`ChainFlip swap failed for tx: ${txHash}`)
}

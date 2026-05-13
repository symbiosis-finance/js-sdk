import type { TransactionReceipt } from '@ethersproject/providers'
import { longPolling } from './utils'
import { TxNotFound } from './constants'
import type { SwapStatusResponseV2 } from '@chainflip/sdk/swap'
import { SwapSDK } from '@chainflip/sdk/swap'
import type { ExtraStepResult } from './types'
import { TradeProvider } from '../trade'
import { ChainId } from '../../constants'

function findChainFlipSwap(receipt: TransactionReceipt) {
    const swapTokenTopic0 = '0x834b524d9f8ccbd31b00b671c896697b96eb4398c0f56e9386a21f5df61e3ce3'
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === swapTokenTopic0
    })

    return !!log
}

export async function waitForChainFlipSwap(receipt: TransactionReceipt): Promise<ExtraStepResult | undefined> {
    const found = findChainFlipSwap(receipt)
    if (!found) {
        return
    }
    const txHash = receipt.transactionHash

    const chainFlipSdk = new SwapSDK({
        network: 'mainnet',
    })
    const response = await longPolling({
        pollingFunction: async (): Promise<SwapStatusResponseV2> => {
            return chainFlipSdk.getStatusV2({ id: txHash })
        },
        successCondition: (response) => {
            return response.state === 'COMPLETED' || response.state === 'SENT'
        },
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10 * 1000, // 10 seconds
    })

    if (response.state !== 'COMPLETED' && response.state !== 'SENT') {
        throw new TxNotFound(txHash)
    }
    if (!response.swapEgress?.txRef) {
        throw new TxNotFound(txHash)
    }

    return {
        provider: TradeProvider.CHAINFLIP_BRIDGE,
        txHash: response.swapEgress.txRef,
        chainId: ChainId.BTC_MAINNET, // TODO fixme
    }
}

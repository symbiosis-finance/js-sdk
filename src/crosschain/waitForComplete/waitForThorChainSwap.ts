import type { TransactionReceipt } from '@ethersproject/providers'
import { longPolling } from './utils'
import type { ExtraStepResult } from './types'
import { TxNotFound } from './constants'
import { thorchainApi } from '../api/thorchain'
import { TradeProvider } from '../trade'
import { ChainId } from '../../constants'

function findThorChainDeposit(receipt: TransactionReceipt) {
    const thorChainDepositTopic0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === thorChainDepositTopic0
    })

    return !!log
}

export async function waitForThorChainTx(receipt: TransactionReceipt): Promise<ExtraStepResult | undefined> {
    if (!findThorChainDeposit(receipt)) {
        return
    }
    const txHash = receipt.transactionHash

    const txHashCleaned = txHash.startsWith('0x') ? txHash.slice(2) : txHash

    const outHash = await longPolling({
        pollingFunction: async () => {
            const result = await thorchainApi.thorchain.tx(txHashCleaned)

            const { status, out_hashes } = result.observed_tx ?? {}
            if (status === 'done' && out_hashes && out_hashes.length > 0) {
                return out_hashes.find((outHash) => {
                    return outHash !== '0000000000000000000000000000000000000000000000000000000000000000'
                })
            }

            return
        },
        successCondition: (btcHash) => !!btcHash,
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10_000, // 10 seconds
    })

    return {
        provider: TradeProvider.THORCHAIN_BRIDGE,
        txHash: outHash,
        chainId: ChainId.BTC_MAINNET, // TODO fixme
    }
}

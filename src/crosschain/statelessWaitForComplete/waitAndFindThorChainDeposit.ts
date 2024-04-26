import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { fetchData, longPolling } from './utils'

interface ThorStatusResponse {
    observed_tx: {
        tx: {
            id: string
        }
        out_hashes?: string[]
        status?: string
    }
}

/**
 * @param symbiosis - context class
 * @param chainId - chain evm id to check event
 * @param txId - transaction hash to check
 * @returns Transaction hash from Thor chain contract in bitcoin network to user's wallet
 */
export async function waitAndFindThorChainDeposit(symbiosis: Symbiosis, chainId: ChainId, txHash: string) {
    const isBtc = await _findThorChainDeposit(symbiosis, chainId, txHash)
    if (!isBtc) {
        return txHash
    }

    const txHashCleaned = txHash.startsWith('0x') ? txHash.slice(2) : txHash
    const thorUrl = new URL(`https://thornode.ninerealms.com/thorchain/tx/${txHashCleaned}`)

    const btcHash = await longPolling({
        pollingFunction: async () => {
            const result: ThorStatusResponse = await fetchData(thorUrl)

            const { status, out_hashes } = result.observed_tx
            if (status === 'done' && out_hashes && out_hashes.length > 0) {
                return out_hashes[0]
            }

            return
        },
        successCondition: (btcHash) => !!btcHash,
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 60_000, // 1 minute
    })

    return btcHash
}

async function _findThorChainDeposit(symbiosis: Symbiosis, chainId: ChainId, txHash: string) {
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const thorChainDepositTopic0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
    const log = receipt.logs.find((log) => {
        return log.topics[0] === thorChainDepositTopic0
    })

    return !!log
}



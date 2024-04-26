import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'

/**
 * @param symbiosis - context class
 * @param chainId - chain evm id to check event
 * @param txId - transaction hash to check
 * @returns Transaction hash from portal contract in bitcoin network to user's wallet
 */
export async function waitBurnSyntheticBtcEvm(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txId: string
): Promise<string | null> {
    const provider = symbiosis.getProvider(chainId)
    const synthesis = symbiosis.synthesis(chainId)

    const receipt = await provider.getTransactionReceipt(txId)

    if (!receipt) {
        throw new TxNotFound(txId)
    }

    const burnRequestBTCTopic = synthesis.interface.getEventTopic('BurnRequestBTC')

    const log = receipt.logs.find((log) => !!log.topics.find((topic) => topic === burnRequestBTCTopic))

    if (!log) {
        return null
    }

    if (log.address.toLowerCase() !== synthesis.address.toLowerCase()) {
        throw new Error(`Transaction ${txId} is not a from synthesis`)
    }

    const [burnSerialBTC] = synthesis.interface.parseLog(log).args

    return burnSerialBTC
}

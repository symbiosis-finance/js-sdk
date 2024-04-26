import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { getLogWithTimeout } from '../utils'

interface BtcEvmTransactionCompleteParams {
    symbiosis: Symbiosis
    btcTx: string
    chainId: ChainId
}

/**
 * @param symbiosis - context class
 * @param chainId - chain evm id to check event
 * @param btcTx - tx from native bitcoin network with money transfer to generated address
 * @returns Transaction hash from portal contract in bitcoin network to user's wallet
 */
export async function waitSynthBtcEvmTxComplete({
    symbiosis,
    btcTx,
    chainId,
}: BtcEvmTransactionCompleteParams): Promise<string> {
    const symBtc = symbiosis.symBtc(chainId)
    const synthesis = symbiosis.synthesis(chainId)

    const externalId = await symBtc.getBTCExternalID(
        `0x${Buffer.from(btcTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const log = await getLogWithTimeout({ symbiosis, chainId, filter })

    return log.transactionHash
}

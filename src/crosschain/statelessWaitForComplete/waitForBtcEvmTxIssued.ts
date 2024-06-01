import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { getLogWithTimeout } from '../utils'

export async function waitForBtcEvmTxIssued(symbiosis: Symbiosis, revealTx: string, chainId: ChainId): Promise<string> {
    const symBtc = symbiosis.symBtc(chainId)
    const synthesis = symbiosis.synthesis(chainId)

    const externalId = await symBtc.getBTCExternalID(
        `0x${Buffer.from(revealTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const log = await getLogWithTimeout({ symbiosis, chainId, filter })

    return log.transactionHash
}

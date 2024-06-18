import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { getLogWithTimeout } from '../utils'

export async function waitForBtcEvmTxIssued(
    symbiosis: Symbiosis,
    revealTx: string,
    btcChainId: ChainId
): Promise<string> {
    const symBtcConfig = symbiosis.symBtcConfigFor(btcChainId)
    const symBtc = symbiosis.symBtcFor(btcChainId)
    const synthesis = symbiosis.synthesis(symBtcConfig.chainId)

    const externalId = await symBtc.getBTCExternalID(
        `0x${Buffer.from(revealTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const log = await getLogWithTimeout({ symbiosis, chainId: symBtcConfig.chainId, filter })

    return log.transactionHash
}

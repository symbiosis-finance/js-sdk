import { Symbiosis } from '../symbiosis'
import { getLogWithTimeout } from '../chainUtils'
import { SymBtc__factory } from '../contracts'
import { BtcConfig } from '../types'

export async function waitForBtcEvmTxIssued(
    symbiosis: Symbiosis,
    revealTx: string,
    btcConfig: BtcConfig
): Promise<string> {
    const { symBtc } = btcConfig

    const symBtcContract = SymBtc__factory.connect(symBtc.address, symbiosis.getProvider(symBtc.chainId))
    const synthesis = symbiosis.synthesis(symBtc.chainId)

    const externalId = await symBtcContract.getBTCExternalID(
        `0x${Buffer.from(revealTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const timeout = 1000 * 60 * 60 * 2 // 2h
    const log = await getLogWithTimeout({ symbiosis, chainId: symBtc.chainId, filter, exceedDelay: timeout })

    return log.transactionHash
}

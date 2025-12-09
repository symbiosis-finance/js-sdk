import { getLogWithTimeout } from '../chainUtils'
import { SymBtc__factory } from '../contracts'
import type { Symbiosis } from '../symbiosis'
import type { BtcConfig } from '../types'
import { waitForDepositUnlocked } from './waitForDepositUnlocked'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForBtcEvmTxIssued(
    symbiosis: Symbiosis,
    revealTx: string,
    btcConfig: BtcConfig
): Promise<string> {
    const { symBtc } = btcConfig

    const { chainId } = symBtc
    const provider = symbiosis.getProvider(chainId)
    const symBtcContract = SymBtc__factory.connect(symBtc.address, provider)
    const synthesis = symbiosis.synthesis(chainId)

    const externalId = await symBtcContract.getBTCExternalID(
        `0x${Buffer.from(revealTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const log = await getLogWithTimeout({ symbiosis, chainId, filter, exceedDelay: timeout })

    const depositUnlocked = await waitForDepositUnlocked(symbiosis, chainId, log.transactionHash)
    if (depositUnlocked) {
        return depositUnlocked.transactionHash
    }

    return log.transactionHash
}

import { getLogWithTimeout } from '../chainUtils'
import { SymBtc__factory } from '../contracts'
import type { Symbiosis } from '../symbiosis'
import type { BtcConfig } from '../types'
import { waitForDepositUnlocked } from './waitForDepositUnlocked'
import type { WaitForCompleteResult } from './types'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForBtcEvmTxIssued(
    symbiosis: Symbiosis,
    revealTx: string,
    btcConfig: BtcConfig
): Promise<WaitForCompleteResult> {
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

    const receipt = await provider.getTransactionReceipt(log.transactionHash)
    const depositUnlocked = await waitForDepositUnlocked(symbiosis, chainId, receipt)
    if (depositUnlocked) {
        return depositUnlocked
    }

    return {
        txHash: log.transactionHash,
        chainId,
    }
}

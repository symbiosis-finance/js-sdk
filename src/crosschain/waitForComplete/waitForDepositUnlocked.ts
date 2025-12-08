import type { LogDescription } from '@ethersproject/abi'
import type { Log } from '@ethersproject/providers'

import type { ChainId } from '../../constants'
import { getLogWithTimeout } from '../chainUtils'
import type { Symbiosis } from '../symbiosis'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForDepositUnlocked(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txHash: string
): Promise<Log | undefined> {
    const d = await symbiosis.depository(chainId)
    if (!d?.depository) {
        return
    }

    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)

    const topic0 = d.depository.interface.getEventTopic('DepositLocked')
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const data: LogDescription = d.depository.interface.parseLog(log)

    const { depositID } = data.args

    const depositUnlockedFilter = d.depository.filters.DepositUnlocked(depositID)
    return getLogWithTimeout({
        symbiosis,
        chainId,
        filter: { ...depositUnlockedFilter, fromBlock: log.blockNumber },
        exceedDelay: timeout,
    })
}

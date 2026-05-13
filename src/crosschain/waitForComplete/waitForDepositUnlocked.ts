import type { LogDescription } from '@ethersproject/abi'
import type { TransactionReceipt } from '@ethersproject/providers'
import type { ChainId } from '../../constants'
import { getLogWithTimeout } from '../chainUtils'
import type { Symbiosis } from '../symbiosis'
import type { ExtraStepResult } from './types'
import { TradeProvider } from '../trade'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForDepositUnlocked(
    symbiosis: Symbiosis,
    chainId: ChainId,
    receipt: TransactionReceipt
): Promise<ExtraStepResult | undefined> {
    const d = await symbiosis.depository(chainId)
    if (!d?.depository) {
        return
    }

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
    const unlockedLog = await getLogWithTimeout({
        symbiosis,
        chainId,
        filter: { ...depositUnlockedFilter, fromBlock: log.blockNumber },
        exceedDelay: timeout,
    })

    return {
        provider: TradeProvider.DEPOSITORY,
        txHash: unlockedLog.transactionHash,
        chainId,
    }
}

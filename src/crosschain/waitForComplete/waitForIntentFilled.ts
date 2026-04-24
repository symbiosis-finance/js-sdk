import type { Log } from '@ethersproject/providers'

import type { ChainId } from '../../constants'
import { getLogWithTimeout } from '../chainUtils'
import { DepositorySrc__factory, DepositoryDst__factory, DirectUnlocker__factory } from '../contracts'
import type { Symbiosis } from '../symbiosis'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForIntentFilled(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txHash: string
): Promise<Log | undefined> {
    debugger
    const intentConfig = symbiosis.chainConfig(chainId).intentConfig
    if (!intentConfig) {
        return
    }

    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)

    const depositorySrc = DepositorySrc__factory.connect(intentConfig.depositorySrc, provider)

    const topic0 = depositorySrc.interface.getEventTopic('IntentLocked')
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const data = depositorySrc.interface.parseLog(log)

    const { intentId, fillCondition } = data.args

    const directUnlockerInterface = DirectUnlocker__factory.createInterface()
    const conditionInputs = directUnlockerInterface.getFunction('encodeCondition').inputs
    const [condition] = directUnlockerInterface._abiCoder.decode(conditionInputs, fillCondition.condition)

    const dstChainId = condition.dstChainId.toNumber() as ChainId

    const dstIntentConfig = symbiosis.chainConfig(dstChainId).intentConfig
    if (!dstIntentConfig) {
        return
    }

    const dstProvider = symbiosis.getProvider(dstChainId)
    const depositoryDst = DepositoryDst__factory.connect(dstIntentConfig.depositoryDst, dstProvider)

    return getLogWithTimeout({
        symbiosis,
        chainId: dstChainId,
        filter: depositoryDst.filters.IntentFilled(intentId),
        exceedDelay: timeout,
    })
}

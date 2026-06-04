import type { ChainId } from '../../constants'
import { getLogWithTimeout } from '../chainUtils'
import { DeadlineUnlocker__factory, DepositoryDst__factory, DepositorySrc__factory } from '../contracts'
import type { Symbiosis } from '../symbiosis'
import { SdkError } from '../sdkError'
import type { WaitForCompleteResult } from './types'
import type { TransactionReceipt } from '@ethersproject/providers'

const timeout = 1000 * 60 * 60 * 2 // 2h

export async function waitForIntentSolved(
    symbiosis: Symbiosis,
    chainId: ChainId,
    receipt: TransactionReceipt
): Promise<WaitForCompleteResult | undefined> {
    const intentConfig = symbiosis.chainConfig(chainId).intentConfig
    if (!intentConfig) {
        return
    }

    const srcProvider = symbiosis.getProvider(chainId)
    const depositorySrc = DepositorySrc__factory.connect(intentConfig.depositorySrc, srcProvider)

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

    const deadlineUnlockerInterface = DeadlineUnlocker__factory.createInterface()
    const conditionInputs = deadlineUnlockerInterface.getFunction('encodeCondition').inputs
    const [condition] = deadlineUnlockerInterface._abiCoder.decode(conditionInputs, fillCondition.condition)

    const dstChainId = condition.dstChainId.toNumber() as ChainId

    const dstIntentConfig = symbiosis.chainConfig(dstChainId).intentConfig
    if (!dstIntentConfig) {
        return
    }

    const dstProvider = symbiosis.getProvider(dstChainId)
    const depositoryDst = DepositoryDst__factory.connect(dstIntentConfig.depositoryDst, dstProvider)

    const filledLog = await getLogWithTimeout({
        symbiosis,
        chainId: dstChainId,
        filter: depositoryDst.filters.IntentFilled(intentId),
        exceedDelay: timeout,
    })

    const filledEvent = depositoryDst.interface.parseLog(filledLog)
    const solutionInputs = deadlineUnlockerInterface.getFunction('encodeSolution').inputs
    const [solution] = deadlineUnlockerInterface._abiCoder.decode(solutionInputs, filledEvent.args.solution)

    switch (solution.branch) {
        case 0: {
            // normal fill
            return {
                txHash: filledLog.transactionHash,
                chainId: dstChainId,
            }
        }
        case 1: {
            // refund
            const unlockedLog = await getLogWithTimeout({
                symbiosis,
                chainId,
                filter: depositorySrc.filters.IntentUnlocked(intentId),
                exceedDelay: timeout,
            })

            return {
                txHash: unlockedLog.transactionHash,
                chainId,
            }
        }
        default:
            throw new SdkError('Unknown solution branch')
    }
}

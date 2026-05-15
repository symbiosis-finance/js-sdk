import type { ChainId } from '../../constants'
import type { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { waitForDepositUnlocked } from './waitForDepositUnlocked'
import { waitForIntentSolved } from './waitForIntentSolved'
import { waitForTonTxComplete } from './waitForTonDepositTxMined'
import type { WaitForCompleteResult } from './types'
import { waitForChainFlipSwap } from './waitForChainFlipSwap'
import { waitForThorChainTx } from './waitForThorChainSwap'
import { waitForUnwrapBtcTxComplete } from './waitForUnwrapBtcTxComplete'

export async function tryToFindExtraStepsAndWait(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txHash: string
): Promise<WaitForCompleteResult | null> {
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const thorChainSwap = await waitForThorChainTx(receipt)
    if (thorChainSwap) {
        return thorChainSwap
    }

    const burnRequestBtc = await waitForUnwrapBtcTxComplete(symbiosis, receipt)
    if (burnRequestBtc) {
        return burnRequestBtc
    }

    const toTonSwap = await waitForTonTxComplete(symbiosis, receipt)
    if (toTonSwap) {
        return toTonSwap
    }

    const chainFlipSwap = await waitForChainFlipSwap(receipt)
    if (chainFlipSwap) {
        return chainFlipSwap
    }

    const depositUnlocked = await waitForDepositUnlocked(symbiosis, chainId, receipt)
    if (depositUnlocked) {
        return depositUnlocked
    }

    const intentSolved = await waitForIntentSolved(symbiosis, chainId, receipt)
    if (intentSolved) {
        return intentSolved
    }

    return null
}

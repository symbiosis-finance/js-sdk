import { Contract, EventFilter } from '@ethersproject/contracts'
import { getExternalId, getLogWithTimeout } from './utils'
import { isTronChainId, tronAddressToEvm } from './tron'

import { ChainId } from '../constants'
import type { Symbiosis } from './symbiosis'

type BridgeRequestType = 'SynthesizeRequest' | 'BurnRequest' | 'RevertBurnRequest'

interface BridgeTxInfo {
    externalId: string
    externalChainId: ChainId
    requestType: BridgeRequestType
}

class TxNotFound extends Error {
    constructor(txId: string) {
        super(`Transaction ${txId} not found`)
    }
}

async function getTxBridgeInfo(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<BridgeTxInfo | null> {
    const provider = symbiosis.getProvider(chainId)

    const receipt = await provider.getTransactionReceipt(txId)

    if (!receipt) {
        throw new TxNotFound(txId)
    }

    const portal = symbiosis.portal(chainId)
    const synthesis = symbiosis.synthesis(chainId)

    const synthesizeRequestTopic = portal.interface.getEventTopic('SynthesizeRequest')
    const burnRequestTopic = synthesis.interface.getEventTopic('BurnRequest')

    const log = receipt.logs.find((log) => {
        return log.topics.includes(synthesizeRequestTopic) || log.topics.includes(burnRequestTopic)
    })

    if (!log) {
        return null
    }

    if (
        log.address.toLowerCase() !== portal.address.toLowerCase() &&
        log.address.toLowerCase() !== synthesis.address.toLowerCase()
    ) {
        throw new Error(`Transaction ${txId} is not a from synthesis or portal contract`)
    }

    let contract: Contract
    let requestType: BridgeRequestType
    if (log.address.toLowerCase() === portal.address.toLowerCase()) {
        contract = portal
        requestType = 'SynthesizeRequest'
    } else {
        contract = synthesis
        requestType = 'BurnRequest'
    }

    const { id, chainID, revertableAddress } = contract.interface.parseLog(log).args

    const externalChainId = chainID.toNumber()

    const contractAddress =
        requestType === 'SynthesizeRequest'
            ? symbiosis.chainConfig(externalChainId).synthesis
            : symbiosis.chainConfig(externalChainId).portal

    const externalId = getExternalId({
        internalId: id,
        contractAddress: tronAddressToEvm(contractAddress),
        revertableAddress: tronAddressToEvm(revertableAddress),
        chainId: externalChainId,
    })

    return {
        externalId,
        externalChainId,
        requestType,
    }
}

async function waitOversideTx(symbiosis: Symbiosis, bridgeInfo: BridgeTxInfo): Promise<string> {
    const { requestType, externalChainId, externalId } = bridgeInfo

    let filter: EventFilter
    if (requestType === 'SynthesizeRequest') {
        const synthesis = symbiosis.synthesis(externalChainId)
        filter = synthesis.filters.SynthesizeCompleted(externalId)
    } else {
        const portal = symbiosis.portal(externalChainId)
        filter = portal.filters.BurnCompleted(externalId)
    }

    const log = await getLogWithTimeout({ symbiosis, chainId: externalChainId, filter })

    return log.transactionHash
}

export async function statelessWaitForComplete(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<string> {
    const txIdWithPrefix = isTronChainId(chainId) ? `0x${txId}` : txId

    const aBridgeInfo = await getTxBridgeInfo(symbiosis, chainId, txIdWithPrefix)
    if (!aBridgeInfo) {
        throw new Error(`Transaction ${txId} is not a bridge request`)
    }

    const bTxId = await waitOversideTx(symbiosis, aBridgeInfo)
    const bBridgeInfo = await getTxBridgeInfo(symbiosis, aBridgeInfo.externalChainId, bTxId)
    if (!bBridgeInfo) {
        // b-chain is final destination
        return bTxId
    }

    return waitOversideTx(symbiosis, bBridgeInfo)
}

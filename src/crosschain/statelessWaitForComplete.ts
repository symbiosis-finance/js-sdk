import { Contract, EventFilter } from '@ethersproject/contracts'
import { getExternalId, getLogWithTimeout } from './utils'
import { isTronChainId, tronAddressToEvm } from './tron'

import { ChainId } from '../constants'
import type { Symbiosis } from './symbiosis'

type BridgeRequestType =
    | 'SynthesizeRequest'
    | 'BurnRequest'
    | 'RevertSynthesizeRequest'
    | 'RevertSynthesizeCompleted'
    | 'RevertBurnCompleted'

interface BridgeTxInfo {
    internalId: string
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

    const revertBurnRequestTopic = portal.interface.getEventTopic('RevertBurnRequest')
    const revertSynthesizeRequestTopic = synthesis.interface.getEventTopic('RevertSynthesizeRequest')

    const revertLog = receipt.logs.find((log) => {
        return !!log.topics.find((topic) => topic === revertBurnRequestTopic || topic === revertSynthesizeRequestTopic)
    })
    if (revertLog) {
        const address = revertLog.address.toLowerCase()
        if (address !== portal.address.toLowerCase() && address !== synthesis.address.toLowerCase()) {
            throw new Error(`Transaction ${txId} is not a from synthesis or portal contract`)
        }

        const bridge = symbiosis.bridge(chainId)
        const oracleRequestTopic = bridge.interface.getEventTopic('OracleRequest')
        const oracleRequestLog = receipt.logs.find((log) => log.topics.includes(oracleRequestTopic))
        if (!oracleRequestLog) {
            throw new Error(`Transaction ${txId} have a OracleRequest call not from bridge contract`)
        }

        const { chainId: oracleRequestChainId } = bridge.interface.parseLog(oracleRequestLog).args

        let contract: Contract
        let requestType: BridgeRequestType
        if (revertLog.address.toLowerCase() === portal.address.toLowerCase()) {
            contract = portal
            requestType = 'RevertBurnCompleted'
        } else {
            contract = synthesis
            requestType = 'RevertSynthesizeCompleted'
        }

        const { id: internalId, to: revertableAddress } = contract.interface.parseLog(revertLog).args

        const externalChainId: number = oracleRequestChainId.toNumber()

        const externalId = getExternalId({
            internalId,
            contractAddress: contract.address,
            revertableAddress: tronAddressToEvm(revertableAddress),
            chainId,
        })

        return { internalId, externalId, externalChainId, requestType }
    }

    const synthesizeRequestTopic = portal.interface.getEventTopic('SynthesizeRequest')
    const burnRequestTopic = synthesis.interface.getEventTopic('BurnRequest')

    const log = receipt.logs.find((log) => {
        return !!log.topics.find((topic) => topic === synthesizeRequestTopic || topic === burnRequestTopic)
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

    const { id: internalId, chainID, revertableAddress } = contract.interface.parseLog(log).args

    const externalChainId = chainID.toNumber()

    const contractAddress =
        requestType === 'SynthesizeRequest'
            ? symbiosis.chainConfig(externalChainId).synthesis
            : symbiosis.chainConfig(externalChainId).portal

    const externalId = getExternalId({
        internalId,
        contractAddress: tronAddressToEvm(contractAddress),
        revertableAddress: tronAddressToEvm(revertableAddress),
        chainId: externalChainId,
    })

    return { internalId, externalId, externalChainId, requestType }
}

async function waitOversideTx(symbiosis: Symbiosis, bridgeInfo: BridgeTxInfo): Promise<string> {
    const { requestType, externalChainId, externalId, internalId } = bridgeInfo

    let filter: EventFilter
    switch (requestType) {
        case 'SynthesizeRequest': {
            const synthesis = symbiosis.synthesis(externalChainId)
            filter = synthesis.filters.SynthesizeCompleted(externalId)
            break
        }

        case 'BurnRequest': {
            const portal = symbiosis.portal(externalChainId)
            filter = portal.filters.BurnCompleted(externalId)
            break
        }

        case 'RevertSynthesizeRequest': {
            const synthesis = symbiosis.synthesis(externalChainId)
            filter = synthesis.filters.RevertSynthesizeRequest(internalId)
            break
        }

        case 'RevertSynthesizeCompleted': {
            const portal = symbiosis.portal(externalChainId)
            filter = portal.filters.RevertSynthesizeCompleted(externalId)
            break
        }

        case 'RevertBurnCompleted': {
            const synthesis = symbiosis.synthesis(externalChainId)
            filter = synthesis.filters.RevertBurnCompleted(externalId)
            break
        }
    }

    const log = await getLogWithTimeout({ symbiosis, chainId: externalChainId, filter })

    return log.transactionHash
}

export async function statelessWaitForComplete(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<string> {
    const txIdWithPrefix = isTronChainId(chainId) ? `0x${txId}` : txId

    console.log('tx', txIdWithPrefix)
    const aBridgeInfo = await getTxBridgeInfo(symbiosis, chainId, txIdWithPrefix)
    if (!aBridgeInfo) {
        throw new Error(`Transaction ${txId} is not a bridge request`)
    }

    console.log('aBridgeInfo', aBridgeInfo)

    const bTxId = await waitOversideTx(symbiosis, aBridgeInfo)
    console.log('bTxId', bTxId)

    const bBridgeInfo = await getTxBridgeInfo(symbiosis, aBridgeInfo.externalChainId, bTxId)
    console.log('bBridgeInfo', bBridgeInfo)

    if (!bBridgeInfo) {
        // b-chain is final destination
        return bTxId
    }

    return waitOversideTx(symbiosis, bBridgeInfo)
}

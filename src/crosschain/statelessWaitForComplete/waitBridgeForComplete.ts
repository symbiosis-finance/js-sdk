import { Contract, EventFilter } from 'ethers'
import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { getExternalId, getLogWithTimeout } from '../utils'
import { tronAddressToEvm } from '../tron'
import { waitAndFindThorChainDeposit } from './waitAndFindThorChainDeposit'

/**
 * @param symbiosis - context class
 * @param chainId - chain evm id to check event
 * @param txId - transaction hash to check
 * @returns Transaction hash from portal contract in bitcoin network to user's wallet
 */
export async function waitBridgeForComplete(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<string> {
    const txIdWithPrefix = txId.startsWith('0x') ? txId : `0x${txId}`

    const aBridgeInfo = await _getTxBridgeInfo(symbiosis, chainId, txIdWithPrefix)
    if (!aBridgeInfo) {
        throw new Error(`Transaction ${txId} is not a bridge request`)
    }

    const bTxId = await _waitOtherSideTx(symbiosis, aBridgeInfo)

    const bBridgeInfo = await _getTxBridgeInfo(symbiosis, aBridgeInfo.externalChainId, bTxId)

    // if b-chain is final destination
    if (!bBridgeInfo) {
        return waitAndFindThorChainDeposit(symbiosis, aBridgeInfo.externalChainId, bTxId)
    }

    const cTxId = await _waitOtherSideTx(symbiosis, bBridgeInfo)

    return waitAndFindThorChainDeposit(symbiosis, bBridgeInfo.externalChainId, cTxId)
}

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

async function _getTxBridgeInfo(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<BridgeTxInfo | null> {
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

async function _waitOtherSideTx(symbiosis: Symbiosis, bridgeInfo: BridgeTxInfo): Promise<string> {
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

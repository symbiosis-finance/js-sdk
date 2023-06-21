import { Contract, EventFilter } from '@ethersproject/contracts'
import { DEFAULT_EXCEED_DELAY, getExternalId, getLogWithTimeout } from './utils'
import { getTransactionInfoById, isTronChainId, tronAddressToEvm } from './tron'

import { ChainId } from '../constants'
import type { Symbiosis } from './symbiosis'
import { TRON_PORTAL_ABI } from './tronAbis'
import { utils } from 'ethers'

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

async function getTronBridgeInfo(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<BridgeTxInfo | null> {
    const tronWeb = symbiosis.tronWeb(chainId)
    const result = await getTransactionInfoById(tronWeb, txId)

    if (!result) {
        throw new TxNotFound(txId)
    }

    const portalInterface = new utils.Interface(TRON_PORTAL_ABI)
    const synthesizeRequestTopic = portalInterface.getEventTopic('SynthesizeRequest').replace('0x', '')

    let request = result.log.find((log) => log.topics[0] === synthesizeRequestTopic)

    if (!request) {
        const revertBurnRequestTopic = portalInterface.getEventTopic('RevertBurnRequest').replace('0x', '')

        request = result.log.find((log) => log.topics[0] === revertBurnRequestTopic)
    }
    if (!request) {
        return null
    }

    const event = portalInterface.parseLog({
        data: `0x${request.data}`,
        topics: request.topics.map((topic) => `0x${topic}`),
    })

    const { id, chainID, revertableAddress } = event.args

    const externalChainId = chainID.toNumber()

    const synthesisAddress = symbiosis.chainConfig(externalChainId).synthesis

    const externalId = getExternalId({
        internalId: id,
        contractAddress: tronAddressToEvm(synthesisAddress),
        revertableAddress: tronAddressToEvm(revertableAddress),
        chainId: externalChainId,
    })

    return {
        externalId,
        externalChainId,
        requestType: 'SynthesizeRequest', // only synthesize is supported for now
    }
}

async function getEvmBridgeTxInfo(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<BridgeTxInfo | null> {
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

    if (log.address !== portal.address && log.address !== synthesis.address) {
        throw new Error(`Transaction ${txId} is not a from synthesis or portal contract`)
    }

    const contract = log.address === portal.address ? portal : synthesis
    const { id, chainID, revertableAddress } = contract.interface.parseLog(log).args

    const externalChainId = chainID.toNumber()

    const requestType: BridgeRequestType = log.address === portal.address ? 'SynthesizeRequest' : 'BurnRequest'

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

async function waitTronTx(symbiosis: Symbiosis, info: BridgeTxInfo): Promise<string> {
    const { externalChainId, externalId } = info

    const { portal } = symbiosis.chainConfig(externalChainId)

    const contract = new Contract(tronAddressToEvm(portal), TRON_PORTAL_ABI)
    const filter = contract.filters.BurnCompleted(externalId)

    const tronWeb = symbiosis.tronWeb(externalChainId)

    let startBlockNumber: number | 'earliest' = 'earliest'
    const start = Date.now()
    while (Date.now() - start < DEFAULT_EXCEED_DELAY) {
        // eth_newFilter is not working for some reason on Tron, so we have to poll
        const [{ result: getLogsResult }, { result: blockNumber }] = (await tronWeb.fullNode.request(
            'jsonrpc',
            [
                {
                    id: 1,
                    method: 'eth_getLogs',
                    params: [{ ...filter, fromBlock: startBlockNumber, toBlock: 'latest' }],
                    jsonrpc: '2.0',
                },
                {
                    id: 2,
                    method: 'eth_blockNumber',
                    params: [],
                    jsonrpc: '2.0',
                },
            ] as unknown as Record<string, unknown>,
            'post'
        )) as [{ result: { transactionHash: string }[] }, { result: number }]

        if (getLogsResult.length) {
            return getLogsResult[0].transactionHash
        }

        startBlockNumber = blockNumber

        await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error(`Burn transaction not found for ${externalId} external id`)
}

async function waitEvmTx(symbiosis: Symbiosis, txInfo: BridgeTxInfo): Promise<string> {
    const { requestType, externalChainId, externalId } = txInfo

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

function getTxBridgeInfo(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<BridgeTxInfo | null> {
    if (isTronChainId(chainId)) {
        return getTronBridgeInfo(symbiosis, chainId, txId)
    }

    return getEvmBridgeTxInfo(symbiosis, chainId, txId)
}

function waitOversideTx(symbiosis: Symbiosis, bridgeInfo: BridgeTxInfo): Promise<string> {
    if (isTronChainId(bridgeInfo.externalChainId)) {
        return waitTronTx(symbiosis, bridgeInfo)
    }

    return waitEvmTx(symbiosis, bridgeInfo)
}

export async function statelessWaitForComplete(symbiosis: Symbiosis, chainId: ChainId, txId: string): Promise<string> {
    const aBridgeInfo = await getTxBridgeInfo(symbiosis, chainId, txId)
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

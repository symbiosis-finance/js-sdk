import { Contract, EventFilter } from '@ethersproject/contracts'
import { getExternalId, getLogWithTimeout } from './utils'
import { tronAddressToEvm } from './tron'

import { ChainId } from '../constants'
import { Symbiosis } from './symbiosis'
import fetch from 'isomorphic-unfetch'
import { delay } from '../utils'
import { BTC_FORWARDER_API } from './swapExactIn/fromBtcSwap'

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

async function waitOtherSideTx(symbiosis: Symbiosis, bridgeInfo: BridgeTxInfo): Promise<string> {
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
    const txIdWithPrefix = txId.startsWith('0x') ? txId : `0x${txId}`

    console.log('tx', txIdWithPrefix)
    const aBridgeInfo = await getTxBridgeInfo(symbiosis, chainId, txIdWithPrefix)
    if (!aBridgeInfo) {
        throw new Error(`Transaction ${txId} is not a bridge request`)
    }

    console.log('aBridgeInfo', aBridgeInfo)

    const bTxId = await waitOtherSideTx(symbiosis, aBridgeInfo)
    console.log('bTxId', bTxId)

    const bBridgeInfo = await getTxBridgeInfo(symbiosis, aBridgeInfo.externalChainId, bTxId)
    console.log('bBridgeInfo', bBridgeInfo)

    // if b-chain is final destination
    if (!bBridgeInfo) {
        return tryToFindThorChainDepositAndWait(symbiosis, aBridgeInfo.externalChainId, bTxId)
    }

    const cTxId = await waitOtherSideTx(symbiosis, bBridgeInfo)

    return tryToFindThorChainDepositAndWait(symbiosis, bBridgeInfo.externalChainId, cTxId)
}

export async function tryToFindThorChainDepositAndWait(symbiosis: Symbiosis, chainId: ChainId, txHash: string) {
    const isBtc = await findThorChainDeposit(symbiosis, chainId, txHash)
    if (!isBtc) {
        return txHash
    }
    return waitForThorChainTx(txHash.startsWith('0x') ? txHash.slice(2) : txHash)
}

export async function findThorChainDeposit(symbiosis: Symbiosis, chainId: ChainId, txHash: string) {
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const thorChainDepositTopic0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
    const log = receipt.logs.find((log) => {
        return log.topics[0] === thorChainDepositTopic0
    })

    return !!log
}

type ThorStatusResponse = {
    observed_tx: {
        tx: {
            id: string
        }
        out_hashes?: string[]
        status?: string
    }
}
export async function getTransactionStatus(txHash: string): Promise<string | undefined> {
    const url = `https://thornode.ninerealms.com/thorchain/tx/${txHash}`

    const response = await fetch(url)

    if (!response.ok) {
        const text = await response.text()
        console.error(`ThorChain status response error: ${text}`)
        return
    }

    const json: ThorStatusResponse = await response.json()

    const { status, out_hashes } = json.observed_tx
    if (status === 'done' && out_hashes && out_hashes.length > 0) {
        return out_hashes[0]
    }

    return
}

export async function waitForThorChainTx(txHash: string): Promise<string> {
    const MINUTES = 60
    let btcHash: string | undefined = undefined
    for (let i = 0; i < MINUTES; i++) {
        btcHash = await getTransactionStatus(txHash)
        if (btcHash) {
            break
        }
        await delay(60 * 1000) // wait for 1 minute
    }
    if (!btcHash) {
        throw new TxNotFound(txHash)
    }
    return btcHash
}

// --- start Bitcoin transaction wait ---
interface WrapTx {
    feeLimit: number
    info: {
        fee: number
        op: number
        sbfee: number
        tail: string
        to: string
    }
}
interface AddressInfo {
    legacyAddress: string
    revealAddress: string
    validUntil: string
    wrap: WrapTx
}

interface TransactionBtcInfo {
    commitOutputIdx: number
    commitTx: string
    incomeOutputIdx: number
    incomeTx: string
    revealTx: string
}

interface Block {
    blockHash: string
    blockTime: number
    confirmations: number
}

interface WrapOperation {
    btcFee: number
    revealInputIdx: number
    revealTx: string
    serial: number
    stableBridgingFee: number
    tail: string
    to: string
    value: number
}

interface WaitBtcTxToCompleteResponse {
    addressInfo: AddressInfo
    transactions: TransactionBtcInfo[]
}
interface TxResponse {
    addressInfo: AddressInfo
    block: Block
    txInfo: TransactionBtcInfo
    wrap: WrapOperation
}

export async function waitBtcTxToComplete(btcAddress: string, blockConfirmations = 1): Promise<string> {
    const addressInfoUrl = new URL(`${BTC_FORWARDER_API.testnet}/address?address=${btcAddress}`)
    const txInfoUrl = new URL(`${BTC_FORWARDER_API.testnet}/tx`)

    const _fetchData = async (url: URL) => {
        const response = await fetch(url)
        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(json.message ?? text)
        }

        const data = await response.json()

        return data
    }

    return new Promise((resolve, reject) => {
        const POLLING_INTERVAL = 1000 * 10 // 10 seconds
        const DEFAULT_EXCEED_DELAY = 1000 * 60 * 20 // 20 minutes

        let pastTime = 0

        let addressResponse: WaitBtcTxToCompleteResponse
        let txResponse: TxResponse

        const getBtcAddressInfo = async () => {
            pastTime += POLLING_INTERVAL
            if (pastTime > DEFAULT_EXCEED_DELAY) {
                clearInterval(interval)
                // [TODO]: Make specific class for error
                reject(new Error(`No revealTx related with address: ${btcAddress}`))
                return
            }

            try {
                if (!addressResponse?.transactions[0]?.revealTx) {
                    addressResponse = await _fetchData(addressInfoUrl)
                    txInfoUrl.searchParams.append('txid', addressResponse.transactions[0].revealTx)
                } else {
                    txResponse = await _fetchData(txInfoUrl)
                }
            } catch (error) {
                console.log('Error from Forawrder tx', error)
            } finally {
                if (txResponse?.block?.confirmations >= blockConfirmations) {
                    resolve(txResponse.txInfo.revealTx)
                    clearInterval(interval)
                }
            }
        }

        const interval = setInterval(getBtcAddressInfo, POLLING_INTERVAL)
    })
}

interface BtcEvmTransactionCompleteParams {
    symbiosis: Symbiosis
    btcTx: string
    chainId: ChainId
}
// [TODO]: Architecture and file organization ???
export async function waitSynthesisBtcEvmTransactionComplete({
    symbiosis,
    btcTx,
    chainId,
}: BtcEvmTransactionCompleteParams): Promise<string> {
    const symBtc = symbiosis.symBtc(chainId)
    const synthesis = symbiosis.synthesis(chainId)

    console.log('----INPUT---', btcTx)
    const externalId = await symBtc.getBTCExternalID(
        `0x${Buffer.from(btcTx, 'hex').reverse().toString('hex')}`,
        0,
        synthesis.address
    )
    console.log('---external id---', externalId)
    const filter = synthesis.filters.BTCSynthesizeCompleted(externalId)

    const log = await getLogWithTimeout({ symbiosis, chainId, filter })

    console.log('----event logs--- ', log)

    return log.transactionHash
}
// --- end Bitcoin transaction wait ---

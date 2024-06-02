import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { fetchData, longPolling } from './utils'
import { TransactionReceipt } from '@ethersproject/providers'
import { Bridge__factory, Synthesis__factory } from '../contracts'
import { BigNumber } from 'ethers'

interface ThorStatusResponse {
    observed_tx: {
        tx: {
            id: string
        }
        out_hashes?: string[]
        status?: string
    }
}

export async function tryToFindExtraStepsAndWait(symbiosis: Symbiosis, chainId: ChainId, txHash: string) {
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const isThorChainDeposit = await findThorChainDeposit(receipt)
    if (isThorChainDeposit) {
        return waitForThorChainTx(txHash)
    }

    const burnSerialBtc = await findBurnRequestBtc(receipt)
    if (burnSerialBtc) {
        const forwarderUrl = symbiosis.config.btc.forwarderUrl
        return waitUnwrapBtcTxComplete(forwarderUrl, burnSerialBtc)
    }

    const isTonDeposit = await findTonOracleRequest(receipt)
    if (isTonDeposit) {
        console.log('This is TON deposit. TON tracking have to be implemented')
    }
    return txHash
}

export async function findThorChainDeposit(receipt: TransactionReceipt) {
    const thorChainDepositTopic0 = '0xef519b7eb82aaf6ac376a6df2d793843ebfd593de5f1a0601d3cc6ab49ebb395'
    const log = receipt.logs.find((log) => {
        return log.topics[0] === thorChainDepositTopic0
    })

    return !!log
}

export async function waitForThorChainTx(txHash: string): Promise<string> {
    const txHashCleaned = txHash.startsWith('0x') ? txHash.slice(2) : txHash
    const thorUrl = new URL(`https://thornode.ninerealms.com/thorchain/tx/${txHashCleaned}`)

    return longPolling({
        pollingFunction: async () => {
            const result: ThorStatusResponse = await fetchData(thorUrl)

            const { status, out_hashes } = result.observed_tx
            if (status === 'done' && out_hashes && out_hashes.length > 0) {
                return out_hashes.find((outHash) => {
                    return outHash !== '0000000000000000000000000000000000000000000000000000000000000000'
                })
            }

            return
        },
        successCondition: (btcHash) => !!btcHash,
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 60_000, // 1 minute
    })
}

async function findBurnRequestBtc(receipt: TransactionReceipt): Promise<BigNumber | undefined> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const topic0 = synthesisInterface.getEventTopic('BurnRequestBTC')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const [burnSerialBTC] = synthesisInterface.parseLog(log).args

    return burnSerialBTC
}

interface UnwrapSerialBTCResponse {
    serial: number
    to: string
    tx: string
    value: number
    outputIdx: string
}
async function waitUnwrapBtcTxComplete(forwarderUrl: string, burnSerialBtc: BigNumber): Promise<string> {
    const unwrapInfoUrl = new URL(`${forwarderUrl}/unwrap?serial=${burnSerialBtc.toString()}`)

    const result = await longPolling<UnwrapSerialBTCResponse>({
        pollingFunction: async (): Promise<UnwrapSerialBTCResponse> => {
            return fetchData(unwrapInfoUrl)
        },
        successCondition: (result) => !!result.outputIdx,
        error: new TxNotFound(burnSerialBtc.toString()),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10_000, // 10 seconds
    })

    return result.tx
}
async function findTonOracleRequest(receipt: TransactionReceipt) {
    const bridgeInterface = Bridge__factory.createInterface()
    const topic0 = bridgeInterface.getEventTopic('OracleRequest')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === topic0
    })
    if (!log) {
        return false
    }

    const decoded = bridgeInterface.decodeEventLog('OracleRequest', log.data)

    return decoded.chainId.toString() === ChainId.TON_MAINNET.toString()
}

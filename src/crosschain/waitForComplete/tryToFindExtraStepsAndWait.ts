import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TxNotFound } from './constants'
import { fetchData, longPolling } from './utils'
import { TransactionReceipt } from '@ethersproject/providers'
import { Synthesis__factory } from '../contracts'
import { BigNumber } from 'ethers'
import { LogDescription } from '@ethersproject/abi'
import { waitForTonTxComplete } from './waitForTonDepositTxMined'
import { SwapSDK, SwapStatusResponse } from '@chainflip/sdk/swap'

interface ThorStatusResponse {
    observed_tx: {
        tx: {
            id: string
        }
        out_hashes?: string[]
        status?: string
    }
}

type ExtraStep = 'thorChain' | 'burnRequestBtc' | 'burnRequestTon' | 'swapEthToTon' | 'chainFlip'

export async function tryToFindExtraStepsAndWait(
    symbiosis: Symbiosis,
    chainId: ChainId,
    txHash: string
): Promise<{ extraStep?: ExtraStep; outHash: string }> {
    const provider = symbiosis.getProvider(chainId)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) {
        throw new TxNotFound(txHash)
    }

    const isThorChainDeposit = await findThorChainDeposit(receipt)
    if (isThorChainDeposit) {
        const outHash = await waitForThorChainTx(txHash)
        return {
            extraStep: 'thorChain',
            outHash,
        }
    }

    const burnRequestBtc = await findBurnRequestBtc(receipt)
    if (burnRequestBtc) {
        const { burnSerial, rtoken } = burnRequestBtc
        const btc = symbiosis.tokens().find((t) => t.address.toLowerCase() === rtoken.toLowerCase())
        if (!btc) {
            throw new Error('BTC token not found')
        }
        const forwarderUrl = symbiosis.getForwarderUrl(btc.chainId)
        const outHash = await waitUnwrapBtcTxComplete(forwarderUrl, burnSerial)

        return {
            extraStep: 'burnRequestBtc',
            outHash,
        }
    }

    const burnRequestTon = await findBurnRequestTON(receipt)
    if (burnRequestTon) {
        const { internalId, chainId } = burnRequestTon

        const outHash = await waitForTonTxComplete(symbiosis, internalId, +chainId)
        return {
            extraStep: 'burnRequestTon',
            outHash,
        }
    }
    const chainFlipSwap = await findChainFlipSwap(receipt)
    if (chainFlipSwap) {
        const outHash = await waitForChainFlipSwap(receipt.transactionHash)
        return {
            extraStep: 'chainFlip',
            outHash,
        }
    }

    return {
        outHash: txHash,
    }
}

export async function findChainFlipSwap(receipt: TransactionReceipt) {
    const swapTokenTopic0 = '0x834b524d9f8ccbd31b00b671c896697b96eb4398c0f56e9386a21f5df61e3ce3'
    const log = receipt.logs.find((log) => {
        return log.topics[0] === swapTokenTopic0
    })

    return !!log
}

export async function waitForChainFlipSwap(txHash: string): Promise<string> {
    const chainFlipSdk = new SwapSDK({
        network: 'mainnet',
    })
    const response = await longPolling({
        pollingFunction: async (): Promise<SwapStatusResponse> => {
            return chainFlipSdk.getStatus({ id: txHash })
        },
        successCondition: (response) => {
            return response.state === 'COMPLETE'
        },
        error: new TxNotFound(txHash),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10 * 1000, // 10 seconds
    })

    return response.broadcastTransactionRef
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

async function findBurnRequestBtc(receipt: TransactionReceipt): Promise<
    | {
          burnSerial: BigNumber
          rtoken: string
      }
    | undefined
> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const topic0 = synthesisInterface.getEventTopic('BurnRequestBTC')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const data: LogDescription = synthesisInterface.parseLog(log)

    const { burnSerial, rtoken } = data.args

    return { burnSerial, rtoken }
}

async function findBurnRequestTON(receipt: TransactionReceipt): Promise<
    | {
          internalId: string
          chainId: string
      }
    | undefined
> {
    const synthesisInterface = Synthesis__factory.createInterface()
    const burnRequestTonTopic = synthesisInterface.getEventTopic('BurnRequestTON')
    const log = receipt.logs.find((log) => {
        return log.topics[0] === burnRequestTonTopic
    })

    if (!log) {
        return
    }
    const data: LogDescription = synthesisInterface.parseLog(log)

    const { id, chainID } = data.args

    return { internalId: id, chainId: chainID.toString() }
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

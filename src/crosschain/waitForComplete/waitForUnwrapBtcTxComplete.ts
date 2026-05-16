import type { TransactionReceipt } from '@ethersproject/providers'
import type { BigNumber } from 'ethers'
import { Synthesis__factory } from '../contracts'
import type { LogDescription } from '@ethersproject/abi'
import type { Symbiosis } from '../symbiosis'
import type { WaitForCompleteResult } from './types'
import { fetchData, longPolling } from './utils'
import { TxNotFound } from './constants'
import { ChainId } from '../../constants'

function findBurnRequestBtc(receipt: TransactionReceipt): { burnSerial: BigNumber; rtoken: string } | undefined {
    const synthesisInterface = Synthesis__factory.createInterface()
    const topic0 = synthesisInterface.getEventTopic('BurnRequestBTC')
    const log = receipt.logs.find((log) => {
        if (log.topics.length === 0) {
            return false
        }
        return log.topics[0] === topic0
    })
    if (!log) {
        return
    }
    const data: LogDescription = synthesisInterface.parseLog(log)

    const { burnSerial, rtoken } = data.args

    return { burnSerial, rtoken }
}

interface UnwrapSerialBTCResponse {
    serial: number
    to: string
    tx: string
    value: number
    outputIdx: string
}

export async function waitForUnwrapBtcTxComplete(
    symbiosis: Symbiosis,
    receipt: TransactionReceipt
): Promise<WaitForCompleteResult | undefined> {
    const burnRequestBtc = findBurnRequestBtc(receipt)
    if (!burnRequestBtc) {
        return
    }
    const { burnSerial, rtoken } = burnRequestBtc
    const btc = symbiosis.tokens().find((t) => t.address.toLowerCase() === rtoken.toLowerCase())
    if (!btc) {
        throw new Error('BTC token not found')
    }
    const btcConfig = symbiosis.getBtcConfig(btc)

    const { forwarderUrl } = btcConfig
    const unwrapInfoUrl = new URL(`${forwarderUrl}/unwrap?serial=${burnSerial.toString()}`)

    const result = await longPolling<UnwrapSerialBTCResponse>({
        pollingFunction: async (): Promise<UnwrapSerialBTCResponse> => {
            return fetchData(unwrapInfoUrl)
        },
        successCondition: (result) => !!result.outputIdx,
        error: new TxNotFound(burnSerial.toString()),
        exceedDelay: 3_600_000, // 1 hour
        pollingInterval: 10_000, // 10 seconds
    })

    return {
        txHash: result.tx,
        chainId: ChainId.BTC_MAINNET,
    }
}

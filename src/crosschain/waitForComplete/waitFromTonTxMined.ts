import { Address, Cell } from '@ton/core'

import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'
import { ParsedTransaction } from '@ton/ton/dist/client/TonClient4'

class waitFromTonTxCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForTonTxCompleteError'
    }
}

const TRANSFER_NOTIFICATION_OPCODE = 0x7362d09c

export interface WaitFromTonTxMinedParams {
    symbiosis: Symbiosis
    address: string
    contractAddress: string
}

export async function waitFromTonTxMined({
    symbiosis,
    address,
    contractAddress,
}: WaitFromTonTxMinedParams): Promise<ParsedTransaction | undefined> {
    const client = await symbiosis.getTonClient()

    const now = Math.floor(Date.now() / 1000)

    return await longPolling<ParsedTransaction | undefined>({
        pollingFunction: async () => {
            const lastBlock = await client.getLastBlock()
            const accountInfo = await client.getAccount(lastBlock.last.seqno, Address.parse(contractAddress))

            // If there are no transactions yet
            if (!accountInfo.account.last) {
                return undefined
            }

            const lt = BigInt(accountInfo.account.last.lt)
            const hash = Buffer.from(accountInfo.account.last.hash, 'hex')

            const txsData = await client.getAccountTransactionsParsed(
                Address.parse(contractAddress),
                lt,
                hash,
                10 // 10 transactions
            )

            const txs = txsData.transactions

            const filtered = txs.filter((tx) => {
                if (tx.time < now) {
                    return false
                }

                if (!tx.inMessage?.body) {
                    return false
                }

                // 1. case for jetton transfer
                const bodyInMsg = Cell.fromBase64(tx.inMessage?.body)

                if (bodyInMsg) {
                    const body = bodyInMsg.beginParse()
                    const opcode = body.loadUint(32)

                    if (opcode === TRANSFER_NOTIFICATION_OPCODE) {
                        body.loadUint(64) // query id skip
                        body.loadCoins() // amount skip
                        const senderAddress = body.loadAddress()
                        if (senderAddress.equals(Address.parse(address))) {
                            return true
                        }
                    }
                }

                // 2. case for TON transfer
                const messageInfo = tx.inMessage?.info

                if (!messageInfo || messageInfo.type !== 'internal') {
                    return false
                }

                const senderAddress = messageInfo.src

                if (!Address.isAddress(senderAddress)) {
                    return false
                }

                return Address.parse(address).equals(senderAddress)
            })
            return filtered.length > 0 ? filtered[0] : undefined // is no reliable logic, we take just last sent tx
        },
        successCondition: (tx) => {
            return tx !== undefined
        },
        error: new waitFromTonTxCompleteError('Ton transaction not found on TON chain'),
    })
}

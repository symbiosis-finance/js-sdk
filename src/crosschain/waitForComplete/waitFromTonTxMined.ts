import { Address, Transaction } from '@ton/core'

import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'

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
}: WaitFromTonTxMinedParams): Promise<Transaction | undefined> {
    const client = await symbiosis.getTonClient()

    const now = Math.floor(Date.now() / 1000)

    return await longPolling<Transaction | undefined>({
        pollingFunction: async () => {
            const lastBlock = await client.getLastBlock()
            const accountInfo = await client.getAccount(lastBlock.last.seqno, Address.parse(contractAddress))

            if (!accountInfo.account.last) {
                return undefined
            }

            const txsRaw = await client.getAccountTransactions(
                Address.parse(contractAddress),
                BigInt(accountInfo.account.last.lt),
                Buffer.from(accountInfo.account.last.hash, 'base64')
            )

            const filtered = txsRaw.filter((txRaw) => {
                if (txRaw.tx.now < now) {
                    return false
                }

                if (!txRaw.tx.inMessage?.body) {
                    return false
                }

                // 1. case for jetton transfer
                const bodyInMsg = txRaw.tx.inMessage.body

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
                const messageInfo = txRaw.tx.inMessage?.info

                if (!messageInfo || messageInfo.type !== 'internal') {
                    return false
                }

                const senderAddress = messageInfo.src

                if (!Address.isAddress(senderAddress)) {
                    return false
                }

                return Address.parse(address).equals(senderAddress)
            })
            return filtered.length > 0 ? filtered[0].tx : undefined // is no reliable logic, we take just last sent tx
        },
        successCondition: (tx) => {
            return tx !== undefined
        },
        error: new waitFromTonTxCompleteError('Ton transaction not found on TON chain'),
    })
}

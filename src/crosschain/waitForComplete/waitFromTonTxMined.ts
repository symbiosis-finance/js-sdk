import { Address, Transaction } from '@ton/core'

import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'

class waitFromTonTxCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForTonTxCompleteError'
    }
}

const TRANSFER_NOTIFICATION_OPCODE = '7362d09c'

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
            const txs = await client.getTransactions(Address.parse(contractAddress), {
                limit: 10,
                archival: true,
            })
            const filtered = txs.filter((tx) => {
                if (tx.now < now) {
                    return false
                }

                // 1. case for jetton transfer
                const bodyInMsg = tx.inMessage?.body

                if (bodyInMsg) {
                    const body = bodyInMsg.beginParse()
                    const opcode = body.loadUint(32).toString(16)

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
                const senderAddress = tx.inMessage?.info.src

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

import { Address, Transaction } from '@ton/core'

import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'
import { JettonWallet } from '@ton/ton'

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
    recipientAddress: string
}

export async function waitFromTonTxMined({
    symbiosis,
    address,
    contractAddress,
    recipientAddress,
}: WaitFromTonTxMinedParams): Promise<Transaction | undefined> {
    const client = await symbiosis.getTonClient()

    const now = Math.floor(Date.now() / 1000)

    return await longPolling<Transaction | undefined>({
        pollingFunction: async () => {
            const txs = await client.getTransactions(Address.parse(contractAddress), {
                limit: 10,
                archival: true,
            })
            console.log('address ---->', address)
            console.log('conrtact address ---->', contractAddress)
            const recipientAddr = Address.parse(recipientAddress)
            const minterAddr = Address.parse(contractAddress)

            const jettonMasterContract = await client.getContractState(minterAddr)

            console.log('jettonWalletCode ---->', jettonMasterContract)

            const filtered = txs.filter((tx) => {
                if (tx.now < now) {
                    return false
                }

                // 1. case for jetton transfer
                const bodyInMsg = tx.inMessage?.body

                console.log('tx ---->', tx)

                console.log('bodyInMsg ---->', bodyInMsg)

                if (bodyInMsg) {
                    const body = bodyInMsg.beginParse()
                    const opcode = body.loadUint(32).toString(16)
                    const query_id = body.loadUint(64)

                    console.log('query_id ---->', query_id)

                    if (opcode === TRANSFER_NOTIFICATION_OPCODE) {
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

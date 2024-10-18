import { TonClient } from '@ton/ton'
import { Address, Transaction } from '@ton/core'

import { ChainId } from '../../constants'
import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'

class waitFromTonTxCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForTonTxCompleteError'
    }
}

// [TODO]: Implement jetton case opcode 0 (return unused TON)
export async function waitFromTonTxMined(
    symbiosis: Symbiosis,
    chainId: ChainId,
    tonAddress: string
): Promise<Transaction | undefined> {
    const tonChainConfig = symbiosis.config.chains.find((chain) => chain.id === chainId)

    if (!tonChainConfig) {
        throw new Error('Ton chain config not found')
    }

    const tonPortal = tonChainConfig.tonPortal
    if (!tonPortal) {
        throw new Error(`Ton portal not found for chain ${chainId}`)
    }

    const client = new TonClient({
        endpoint: tonChainConfig.rpc,
    })

    const now = Math.floor(Date.now() / 1000)

    return await longPolling<Transaction | undefined>({
        pollingFunction: async () => {
            const txs = await client.getTransactions(Address.parse(tonPortal), { limit: 20 })
            const filtered = txs.filter((tx) => {
                if (tx.now < now) {
                    return false
                }

                const senderAddress = tx.inMessage?.info.src
                if (!Address.isAddress(senderAddress)) {
                    return false
                }

                return Address.parse(tonAddress).equals(senderAddress)
            })
            return filtered.length > 0 ? filtered[0] : undefined // is no reliable logic, we take just last sent tx
        },
        successCondition: (tx) => {
            return tx !== undefined
        },
        error: new waitFromTonTxCompleteError('Ton transaction not found on TON chain'),
    })
}

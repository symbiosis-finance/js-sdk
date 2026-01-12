import { AddressZero } from '@ethersproject/constants'
import { keccak256 } from '@ethersproject/solidity'
import type { Cell, Transaction } from '@ton/core'
import { Address } from '@ton/core'
import type { Maybe } from '@ton/ton/dist/utils/maybe'

import type { ChainId } from '../../constants'
import type { Symbiosis } from '../symbiosis'
import { longPolling } from './utils'

// The event is defined by its opcode, i.e. first 32 bits of the body
const BURN_COMPLETED_OPCODE = 0x62e558c2

interface BurnCompletedEvent {
    externalId: Buffer
    crossChainId: Buffer
    receiver: Address
    amount: bigint
    fee: bigint
    tokenAddr: Address
}

function parseBurnCompletedBody(msgBody: Cell): Maybe<BurnCompletedEvent> {
    const bodySlice = msgBody.beginParse()

    const opcode = bodySlice.loadUint(32)
    if (opcode === BURN_COMPLETED_OPCODE) {
        // The payload of 'burn_completed' event is split into 2 child cells
        // because it doesn't fit the cell size (1023 bits).
        const burnCompletedData1 = bodySlice.loadRef().beginParse()
        const burnCompletedData2 = bodySlice.loadRef().beginParse()

        const externalId = burnCompletedData1.loadBuffer(32)
        const crossChainId = burnCompletedData1.loadBuffer(32)
        const receiver = burnCompletedData1.loadAddress()

        const amount = burnCompletedData2.loadCoins()
        const fee = burnCompletedData2.loadCoins()
        const tokenAddr = burnCompletedData2.loadAddress()

        return {
            externalId,
            crossChainId,
            receiver,
            amount,
            fee,
            tokenAddr,
        }
    } else {
        return null
    }
}

//Synthesis.sol --> bytes32 externalID = keccak256(abi.encodePacked(internalID, _receiveSide, _chainID));
function _getExternalIdTon({
    internalId,
    receiveSide,
    chainId,
}: {
    internalId: string
    receiveSide: string
    chainId: ChainId
}) {
    return keccak256(['bytes32', 'address', 'uint256'], [internalId, receiveSide, chainId])
}

class WaitForTonTxCompleteError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WaitForTonTxCompleteError'
    }
}

export async function waitForTonTxComplete(symbiosis: Symbiosis, internalId: string, chainId: ChainId) {
    const tonChainConfig = symbiosis.config.chains.find((chain) => chain.id === chainId)
    if (!tonChainConfig) {
        throw new Error('Ton chain config not found')
    }

    const tonPortal = tonChainConfig.tonPortal
    if (!tonPortal) {
        throw new Error(`Ton portal not found for chain ${chainId}`)
    }

    const externalId = _getExternalIdTon({ internalId, receiveSide: AddressZero, chainId })

    const client = await symbiosis.getTonClient()

    const txRaw = await longPolling<{
        block: {
            workchain: number
            seqno: number
            shard: string
            rootHash: string
            fileHash: string
        }
        tx: Transaction
    }>({
        pollingFunction: async () => {
            const lastBlock = await client.getLastBlock()
            const accountInfo = await client.getAccount(lastBlock.last.seqno, Address.parse(tonPortal))

            if (!accountInfo.account.last) {
                return undefined
            }

            const txsRaw = await client.getAccountTransactions(
                Address.parse(tonPortal),
                BigInt(accountInfo.account.last.lt),
                Buffer.from(accountInfo.account.last.hash, 'base64')
            )

            return txsRaw.find(({ tx }) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                return Array.from(tx.outMessages).find(([_, msg]) => {
                    if (msg.info.type !== 'external-out') {
                        return false
                    }
                    const burnCompletedEvent = parseBurnCompletedBody(msg.body)
                    if (!burnCompletedEvent) {
                        return false
                    }

                    return burnCompletedEvent.externalId.equals(Buffer.from(externalId.slice(2), 'hex'))
                })
            })
        },
        successCondition: (tx) => {
            return tx !== undefined
        },
        error: new WaitForTonTxCompleteError('Ton transaction not found on TON chain'),
    })

    return txRaw.tx.hash().toString('hex')
}

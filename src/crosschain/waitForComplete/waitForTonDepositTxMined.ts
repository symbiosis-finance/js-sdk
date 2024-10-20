import { TonClient } from '@ton/ton'
import { Address, Cell, Transaction } from '@ton/core'
import { Maybe } from '@ton/ton/dist/utils/maybe'
import { solidityKeccak256 } from 'ethers/lib/utils'

import { ChainId } from '../../constants'
import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'
import { AddressZero } from '@ethersproject/constants'

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
    return solidityKeccak256(['bytes32', 'address', 'uint256'], [internalId, receiveSide, chainId])
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

    const client = new TonClient({
        endpoint: tonChainConfig.rpc,
    })

    const tx = await longPolling<Transaction>({
        pollingFunction: async () => {
            const txs = await client.getTransactions(Address.parse(tonPortal), { limit: 10, archival: true })
            return txs.find((tx) => {
                return tx.outMessages.values().find((msg) => {
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

    return tx.hash().toString('hex')
}

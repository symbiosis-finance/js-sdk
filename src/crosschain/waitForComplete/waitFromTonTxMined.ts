import { TonClient } from '@ton/ton'
import { Address, Cell, Slice, Transaction } from '@ton/core'
import { Maybe } from '@ton/ton/dist/utils/maybe'

import { ChainId } from '../../constants'
import { longPolling } from './utils'
import { Symbiosis } from '../symbiosis'
import { BridgeTxInfo } from './types'

// The event is defined by its opcode, i.e. first 32 bits of the body
const ORACLE_REQUEST_OPCODE = 0x7b425851
// const TRANSFER_NOTIFICATION_OPCODE = 0x0

const META_SYNTHESIZE_SELECTOR = 'c29a91bc' // metaMintSyntheticToken(...)
const SYNTHESIZE_SELECTOR = 'a83e754b' // mintSyntheticToken(...)

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
): Promise<BridgeTxInfo> {
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

    const accountInfo = await client.getContractState(Address.parse(tonPortal))
    const lastTx = accountInfo.lastTransaction?.lt

    let internalId, externalId

    await longPolling<Transaction[]>({
        pollingFunction: async () => {
            return client.getTransactions(Address.parse(tonPortal), { limit: 10, lt: lastTx })
        },
        successCondition: (txs) => {
            let status = false

            for (const tx of txs) {
                const outMsgs = tx.outMessages
                // case for TON only (called directly from user)
                const senderAddress = tx.inMessage?.info.src

                if (Address.isAddress(senderAddress) && !Address.parse(tonAddress).equals(senderAddress)) {
                    continue
                }

                for (const outMsg of outMsgs.values()) {
                    if (outMsg?.info.type === 'external-out') {
                        const parsedOracleRequest = parseOracleRequestBody(outMsg.body)

                        if (parsedOracleRequest?.externalId && parsedOracleRequest?.internalId) {
                            status = true
                            internalId = parsedOracleRequest.internalId
                            externalId = parsedOracleRequest.externalId
                        }
                    }
                }
            }

            return status
        },
        error: new waitFromTonTxCompleteError('Ton transaction not found on TON chain'),
    })

    if (!internalId || !externalId) {
        throw new Error('Invalid oracle request body')
    }

    return {
        internalId,
        externalId,
        externalChainId: 97, // [TODO]: get from pool config
        requestType: 'SynthesizeRequest',
    }
}

interface OracleRequestEvent {
    externalId: string
    internalId: string
}

function loadHexBytes(slice: Slice, bytesCount: number): string {
    return slice.loadBuffer(bytesCount).toString('hex')
}

function parseOracleRequestBody(msgBody: Cell): Maybe<OracleRequestEvent> {
    const bodySlice = msgBody.beginParse()

    const opcode = bodySlice.loadUint(32)

    if (opcode === ORACLE_REQUEST_OPCODE) {
        const refCalldata = bodySlice.loadRef().beginParse()

        const ref1 = refCalldata.loadRef().beginParse()
        const ref2 = refCalldata.loadRef().beginParse()

        const functionSelector = loadHexBytes(ref1, 4) // function selector

        let internalId, externalId

        if (functionSelector === META_SYNTHESIZE_SELECTOR) {
            ref1.loadBuffer(64) // stable_bridging_fee, amount
            internalId = loadHexBytes(ref1, 32) // internal_id
            externalId = loadHexBytes(ref2, 32) // external_id
        } else if (functionSelector === SYNTHESIZE_SELECTOR) {
            ref1.loadBuffer(32) // stable_bridging_fee
            externalId = loadHexBytes(ref1, 32) // external_id
            internalId = loadHexBytes(ref1, 32) // internal_id
        }

        if (!internalId || !externalId) {
            throw new Error('Invalid oracle request body')
        }

        return {
            internalId: '0x' + internalId,
            externalId: '0x' + externalId,
        }
    }

    return null
}

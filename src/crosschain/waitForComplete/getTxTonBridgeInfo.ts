import { Cell, Slice, Transaction } from '@ton/core'
import { ChainId } from '../../constants'
import { BridgeTxInfo } from './types'

// The event is defined by its opcode, i.e. first 32 bits of the body
const ORACLE_REQUEST_OPCODE = 0x7b425851
const TRANSFER_NOTIFICATION_OPCODE = '7362d09c' // jetton transfer

const META_SYNTHESIZE_SELECTOR = 'c29a91bc' // metaMintSyntheticToken(...)
const SYNTHESIZE_SELECTOR = 'a83e754b' // mintSyntheticToken(...)

interface OracleRequestEvent {
    externalId: string
    internalId: string
    externalChainId: number
}

// [TODO]: Do all logic via tx hash only
export function getTxTonBridgeInfo(tx: Transaction): BridgeTxInfo {
    let internalId: string | undefined
    let externalId: string | undefined
    let externalChainId: ChainId | undefined

    for (const outMsg of tx.outMessages.values()) {
        if (outMsg?.info.type !== 'external-out') {
            continue
        }
        const parsedOracleRequest = parseOracleRequestBody(outMsg.body)
        internalId = parsedOracleRequest?.internalId
        externalId = parsedOracleRequest?.externalId
        externalChainId = parsedOracleRequest?.externalChainId
        break
    }
    if (!internalId || !externalId || !externalChainId) {
        throw new Error('Invalid oracle request body')
    }

    return {
        internalId,
        externalId,
        externalChainId,
        requestType: 'SynthesizeRequest',
    }
}

function loadHexBytes(slice: Slice, bytesCount: number): string {
    return slice.loadBuffer(bytesCount).toString('hex')
}

function parseOracleRequestBody(msgBody: Cell): OracleRequestEvent | undefined {
    const bodySlice = msgBody.beginParse()

    const opcode = bodySlice.loadUint(32)
    if (opcode !== ORACLE_REQUEST_OPCODE) {
        return
    }

    const refCalldata = bodySlice.loadRef().beginParse()

    bodySlice.loadInt(8) // wc
    bodySlice.loadBuffer(32) // addr hash
    bodySlice.loadBuffer(20) // receive_side
    bodySlice.loadBuffer(20) // opposite_bridge
    const externalChainId = bodySlice.loadUint(256) // external_chain_id

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
        externalChainId,
    }
}

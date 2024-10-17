import {
    Address,
    beginCell,
    BitBuilder,
    BitString,
    Cell,
    Contract,
    contractAddress,
    ContractProvider,
    // OpenedContract,
    Sender,
    SendMode,
    Slice,
    toNano,
} from '@ton/core'
import { secp256k1 as secp } from '@noble/curves/secp256k1'
import { keccak256 } from 'ethers/lib/utils'
import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { TokenAmount } from '../../entities'
import { TonTransactionData } from '../types'
import { Error } from '../error'
// import { WalletContractV4 } from '@ton/ton'

export const EVM_TO_TON: Record<string, string> = {
    '0x7ea393298d1077e19ec59f8e3fe8fe642738c08c': 'EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4', // TON
    '0x46deec715e419a1f0f5959b5c8450894959d2dbf': 'EQD73uqQJHKAg140YSlG3uxxXkGaHw9ZWbXIRQiUlZ0tv79a', // USDT
}

export function isTonChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.TON_MAINNET, ChainId.TON_TESTNET].includes(chainId)
}

// Function to hash the message
function hashMessage(message: Buffer): Buffer {
    return Buffer.from(keccak256(message), 'hex')
}

// Hash and sign the message
export async function sign(msg: Buffer, private_key: Uint8Array): Promise<Buffer> {
    const signatureObj = await secp.sign(hashMessage(msg), private_key)
    return Buffer.concat([signatureObj.toCompactRawBytes(), Buffer.from([signatureObj.recovery])])
}

export function collectMetaMintSyntheticTokenCalldata(cell: Cell): string {
    const slice = cell.beginParse()

    const ref1 = slice.loadRef().beginParse()
    const ref2 = slice.loadRef().beginParse()
    const ref3 = slice.loadRef().beginParse()
    const ref4 = slice.loadRef().beginParse()
    const ref4_1 = ref4.loadRef().beginParse()
    const ref4_2 = ref4.loadRef().beginParse()

    const ref4_2_1 = ref4_2.loadRef()
    const ref4_2_2 = ref4_2.loadRef()

    let res = ''

    res += loadHexBytes(ref1, 4) // function selector
    res += loadHexBytes(ref1, 32) // stable_bridging_fee
    res += loadHexBytes(ref1, 32) // amount
    res += loadHexBytes(ref1, 32) // internal_id

    res += loadHexBytes(ref2, 32) // external_id
    res += loadHexBytes(ref2, 32) // token_eth_addr
    res += loadHexBytes(ref2, 32) // TON_CHAIN_ID
    res += loadHexBytes(ref2, 12) // 12 bytes padding for chain_2_address

    res += loadHexBytes(ref3, 20) // chain_2_address
    res += loadHexBytes(ref3, 32) // offset of swap_tokens array
    res += loadHexBytes(ref3, 32) // second_dex_router
    res += loadHexBytes(ref3, 32) // offset of second_swap_call_data bytes

    res += loadHexBytes(ref4, 32) // final_receive_side
    res += loadHexBytes(ref4, 32) // offset of final_call_data bytes
    res += loadHexBytes(ref4, 32) // final_offset

    res += loadHexBytes(ref4_1, ref4_1.remainingBits / 8) // swap_tokens array

    res += loadHexBytes(ref4_2, 32) // second_swap_call_data length
    res += cellToCallDataHex(ref4_2_1) // second_swap_call_data

    res += loadHexBytes(ref4_2, 32) // final_call_data length
    res += cellToCallDataHex(ref4_2_2) // final_call_data

    return res
}

export function collectMintSyntheticTokenCalldata(cell: Cell): string {
    const slice = cell.beginParse()

    const ref1 = slice.loadRef().beginParse()
    const ref2 = slice.loadRef().beginParse()
    const ref3 = slice.loadRef().beginParse()

    let res = ''

    res += loadHexBytes(ref1, 4) // function selector
    res += loadHexBytes(ref1, 32) // stable_bridging_fee
    res += loadHexBytes(ref1, 32) // external_id
    res += loadHexBytes(ref1, 32) // internal_id

    res += loadHexBytes(ref2, 32) // token_eth_addr
    res += loadHexBytes(ref2, 32) // TON_CHAIN_ID

    res += loadHexBytes(ref3, 32) // amount
    res += loadHexBytes(ref3, 32) // chain_2_address

    return res
}

function loadHexBytes(slice: Slice, bytesCount: number): string {
    return slice.loadBuffer(bytesCount).toString('hex')
}

export function callDataToCell(finalCallData: Buffer): Cell {
    const MAX_BYTES_IN_CELL = 127

    function padBuffer(buf: Buffer): Buffer {
        const targetLength = Math.ceil(buf.length / 32) * 32
        const paddingLength = targetLength - buf.length

        if (paddingLength === 0) {
            return buf
        }

        const paddedBuffer = Buffer.alloc(targetLength)
        buf.copy(paddedBuffer)
        return paddedBuffer
    }

    function createCell(buf: Buffer): Cell {
        const builder = beginCell()

        const bytesToStore = buf.subarray(0, MAX_BYTES_IN_CELL)
        builder.storeBuffer(bytesToStore)

        if (buf.length > MAX_BYTES_IN_CELL) {
            const remainingBuffer = buf.subarray(MAX_BYTES_IN_CELL)
            builder.storeRef(createCell(remainingBuffer))
        }

        return builder.endCell()
    }

    return createCell(padBuffer(finalCallData))
}

function cellToCallDataHex(cell: Cell): string {
    const buffers: Buffer[] = []

    function collectBytes(currentCell: Cell) {
        const currentSlice = currentCell.beginParse()
        buffers.push(currentSlice.loadBuffer(currentSlice.remainingBits / 8))

        if (currentCell.refs.length > 0) {
            collectBytes(currentCell.refs[0])
        }
    }
    collectBytes(cell)

    return Buffer.concat(buffers).toString('hex')
}

export const TON_CHAIN_ID = 85918

export const TON_CHAIN_ID_BUFFER: Buffer = beginCell().storeUint(TON_CHAIN_ID, 32).endCell().beginParse().loadBuffer(4)

export type BridgeConfig = {
    isPaused: boolean
    owner: Address
    admin: Address
    mpcAddress: Buffer
    externalIdContractCode: Cell
    tonAddress: Address
}

export const Opcodes = {
    EpSetIsPaused: 813515931,
    EpSetOwner: 171034560,
    EpWithdrawFee: 666076618,
    EpChangeMPC: 4088934783,
    EpChangeMPCSigned: 2263527702,
    EpReceiveRequestV2Signed: 1528786663,
    EpReceiveRequestV2SignedContinuation: 2983749531,
    EpAddWhitelistedJetton: 4068725157,
    EpRemoveWhitelistedJetton: 3984169854,
    EpSetTonTokenAddress: 3379498946,
    ExpiredExternalIdResponse: 3112622900,
    EpSetJettonThreshold: 1712822444,
    EpSynthesize: 2048159929,
    EpMetaSynthesize: 1585287200,
}

export const ErrorCodes = {
    ReqOwner: 1001,
    ReqOwnerOrAdmin: 1002,
    InvalidSignature: 1003,
    InsufficientAmount: 1004,
    InsufficientBalance: 1005,
    ContractPaused: 1006,
    UnexpectedSender: 1007,
    UnknownJetton: 1008,
    InsufficientMessageValue: 1009,
    AmountUnderThreshold: 1010,
    MalformedForwardPayload: 1011,
    TokenAddressMismatch: 1012,
    AmountMismatch: 1013,
    ZeroMpcAddr: 1014,
    UnknownOp: 65535,
}

export const EventIds = {
    MPCChanged: BigInt(3246037916),
    BurnCompleted: BigInt(1659197634),
    SetJettonThreshold: BigInt(3303282619),
    OracleRequest: BigInt(2067945553),
}

export const ErrorMessages = {
    InsufficientJettons: 'Jetton amount should be greater than fee.',
}

export function bridgeConfigToCell(config: BridgeConfig): Cell {
    return beginCell()
        .storeUint(config.isPaused ? 1 : 0, 1)
        .storeAddress(config.owner)
        .storeAddress(config.admin)
        .storeBuffer(config.mpcAddress)
        .storeDict(null)
        .storeRef(config.externalIdContractCode)
        .storeDict(null)
        .storeAddress(config.tonAddress)
        .storeRef(beginCell().storeDict(null).storeUint(0, 256).endCell())
        .endCell()
}

export class Bridge implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new Bridge(address)
    }

    static createFromConfig(config: BridgeConfig, code: Cell, workchain = 0) {
        const data = bridgeConfigToCell(config)
        const init = { code, data }
        return new Bridge(contractAddress(workchain, init), init)
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        })
    }

    async getExternalIdAddress(provider: ContractProvider, externalId: Buffer): Promise<Address> {
        const arg = beginCell().storeBuffer(externalId).endCell()
        const res = await provider.get('get_external_id_address', [{ type: 'slice', cell: arg }])
        return res.stack.readAddress()
    }

    async getMpc(provider: ContractProvider): Promise<Buffer> {
        const res = await provider.get('get_mpc', [])
        return res.stack.readBuffer()
    }

    static setIsPausedMessage(isPaused: boolean): Cell {
        return beginCell().storeUint(Opcodes.EpSetIsPaused, 32).storeBit(isPaused).endCell()
    }

    static setOwnerMessage(owner: Address): Cell {
        return beginCell().storeUint(Opcodes.EpSetOwner, 32).storeAddress(owner).endCell()
    }

    static changeMpcMessage(mpc: Buffer): Cell {
        return beginCell().storeUint(Opcodes.EpChangeMPC, 32).storeBuffer(mpc).endCell()
    }

    static changeMpcSignedMessage(mpc: Buffer, signature: Buffer): Cell {
        return beginCell().storeUint(Opcodes.EpChangeMPCSigned, 32).storeBuffer(mpc).storeBuffer(signature).endCell()
    }

    static addWhitelistedJettonMessage(tokenAddress: Address, jettonWalletAddress: Address, balance: bigint): Cell {
        return beginCell()
            .storeUint(Opcodes.EpAddWhitelistedJetton, 32)
            .storeAddress(tokenAddress)
            .storeAddress(jettonWalletAddress)
            .storeCoins(balance)
            .endCell()
    }

    static removeWhitelistedJettonMessage(tokenAddress: Address): Cell {
        return beginCell().storeUint(Opcodes.EpRemoveWhitelistedJetton, 32).storeAddress(tokenAddress).endCell()
    }

    static setTonTokenAddressMessage(tonTokenAddress: Address): Cell {
        return beginCell().storeUint(Opcodes.EpSetTonTokenAddress, 32).storeAddress(tonTokenAddress).endCell()
    }

    static withdrawFeeMessage(token: Address, receiver: Address, amount: bigint): Cell {
        return beginCell()
            .storeUint(Opcodes.EpWithdrawFee, 32)
            .storeAddress(token)
            .storeAddress(receiver)
            .storeCoins(amount)
            .endCell()
    }

    static receiveRequestV2SignedMessage(
        token: Address,
        receiver: Address,
        externalId: Buffer,
        crossChainID: Buffer,
        amount: bigint,
        fee: bigint,
        signature: Buffer
    ): Cell {
        const callData1 = beginCell().storeAddress(token).storeAddress(receiver).storeBuffer(externalId).endCell()

        const callData2 = beginCell()
            .storeBuffer(crossChainID)
            .storeCoins(amount)
            .storeCoins(fee)
            // Padding; So hash function used here and the hashing instruction in TVM does
            // not like the source message to contain a non-integer number of bytes. So we
            // pad this part of payload with some zeros so that when both parts are put together
            // they ll form an integer number of bytes.
            //
            // In this case, it turns out that we should add 2 bits to make it aligned.
            .storeBits(new BitString(Buffer.from('00', 'hex'), 0, 2))
            .endCell()

        return beginCell()
            .storeUint(Opcodes.EpReceiveRequestV2Signed, 32)
            .storeRef(callData1)
            .storeRef(callData2)
            .storeBuffer(signature)
            .endCell()
    }

    // Creates forward payload for 'synthesize' endpoint
    static synthesizeMessage({
        stableBridgingFee,
        token,
        amount,
        chain2Address,
        receiveSide,
        oppositeBridge,
        revertableAddress,
        chainId,
    }: {
        stableBridgingFee: bigint
        token: Address
        amount: bigint
        chain2Address: Buffer
        receiveSide: Buffer
        oppositeBridge: Buffer
        revertableAddress: Buffer
        chainId: bigint
    }): Cell {
        const payloadCell1 = beginCell()
            .storeCoins(stableBridgingFee)
            .storeAddress(token) // token
            .storeCoins(amount)
            .storeBuffer(chain2Address)
            .storeBuffer(receiveSide)
            .endCell()

        const payloadCell2 = beginCell()
            .storeBuffer(oppositeBridge)
            .storeBuffer(revertableAddress)
            .storeUint(chainId, 256)
            .endCell()

        return beginCell().storeUint(Opcodes.EpSynthesize, 32).storeRef(payloadCell1).storeRef(payloadCell2).endCell()
    }

    static metaSynthesizeMessage({
        stableBridgingFee,
        token,
        amount,
        chain2Address,
        receiveSide,
        oppositeBridge,
        chainId,
        finalReceiveSide,
        finalOffset,
        revertableAddress,
        swapTokens,
        secondDexRouter,
        secondSwapCallData,
        finalCallData,
    }: {
        stableBridgingFee: bigint
        token: Address
        amount: bigint
        chain2Address: Buffer
        receiveSide: Buffer
        oppositeBridge: Buffer
        chainId: bigint
        finalReceiveSide: Buffer
        finalOffset: bigint
        revertableAddress: Buffer
        swapTokens: Buffer[]
        secondDexRouter: Buffer
        secondSwapCallData: Buffer
        finalCallData: Buffer
    }): Cell {
        const payloadCell1 = beginCell()
            .storeCoins(stableBridgingFee)
            .storeAddress(token)
            .storeCoins(amount)
            .storeBuffer(chain2Address)

        const payloadCell2 = beginCell()
            .storeBuffer(receiveSide)
            .storeBuffer(oppositeBridge)
            .storeUint(chainId, 256)
            .storeBuffer(finalReceiveSide)

        const swapTokensCellBuilder = beginCell()
        swapTokens.forEach((tokenAddr) => swapTokensCellBuilder.storeBuffer(tokenAddr))

        const finalCallDataCell = callDataToCell(finalCallData)
        const secondSwapCallDataCell = callDataToCell(secondSwapCallData)

        const payloadCell3 = beginCell()
            .storeUint(finalOffset, 256)
            .storeBuffer(revertableAddress)
            .storeUint(finalCallData.length, 64)
            .storeRef(swapTokensCellBuilder.endCell())
            .storeRef(finalCallDataCell)
            .storeBuffer(secondDexRouter)
            .storeRef(secondSwapCallDataCell)
            .storeUint(secondSwapCallData.length, 64)
            .endCell()

        return beginCell()
            .storeUint(Opcodes.EpMetaSynthesize, 32)
            .storeRef(payloadCell1)
            .storeRef(payloadCell2)
            .storeRef(payloadCell3)
            .endCell()
    }

    static setJettonThresholdMessage(token: Address, threshold: bigint): Cell {
        return beginCell()
            .storeUint(Opcodes.EpSetJettonThreshold, 32)
            .storeAddress(token)
            .storeCoins(threshold)
            .endCell()
    }

    static async createReceiveRequestSignature(
        privateKey: Uint8Array,
        bridgeAddress: Address,
        token: Address,
        receiver: Address,
        externalId: Buffer,
        crossChainID: Buffer,
        amount: bigint,
        fee: bigint
    ): Promise<Buffer> {
        const callData1 = beginCell().storeAddress(token).storeAddress(receiver).storeBuffer(externalId).endCell()

        const callData2 = beginCell()
            .storeBuffer(crossChainID)
            .storeCoins(amount)
            .storeCoins(fee)
            // Padding; So hash function used here and the hashing instruction in TVM does
            // not like the source message to contain a non-integer number of bytes. So we
            // pad this part of payload with some zeros so that when both parts are put together
            // they ll form an integer number of bytes.
            //
            // In this case, it turns out that we should add 2 bits to make it aligned.
            .storeBits(new BitString(Buffer.from('00', 'hex'), 0, 2))
            .endCell()

        const bitBuilder = new BitBuilder(1024 * 10)
        bitBuilder.writeBits(callData1.bits)
        bitBuilder.writeBits(callData2.bits)
        const payloadBuffer = bitBuilder.buffer()

        const toSign = Buffer.concat([
            Buffer.from('receiveRequestV2'),
            payloadBuffer,
            bridgeAddress.toRaw(),
            TON_CHAIN_ID_BUFFER,
        ])

        const signature = await sign(toSign, privateKey)

        return signature
    }

    static async createChangeMpcSignature(
        privateKey: Uint8Array,
        mpc: Buffer,
        bridgeAddress: Address
    ): Promise<Buffer> {
        const toSign = Buffer.concat([Buffer.from('changeMPC'), mpc, bridgeAddress.toRaw(), TON_CHAIN_ID_BUFFER])
        const signature = await sign(toSign, privateKey)

        return signature
    }

    /**
     * Helper function for tests
     */
    static createReceiveRequestV2SignedPayload(
        tokenAddress: Address,
        receiverAddress: Address,
        externalId: Buffer,
        crossChainID: Buffer,
        amount: bigint,
        fee: bigint
    ): [Cell, Cell] {
        const payload1 = beginCell()
            .storeAddress(tokenAddress)
            .storeAddress(receiverAddress)
            .storeBuffer(externalId)
            .endCell()

        const payload2 = beginCell()
            .storeBuffer(crossChainID)
            .storeCoins(amount)
            .storeCoins(fee)
            // Padding; So hash function used here and the hashing instruction in TVM does
            // not like the source message to contain a non-integer number of bytes. So we
            // pad this part of payload with some zeros so that when both parts are put together
            // they ll form an integer number of bytes.
            //
            // In this case, it turns out that we should add 2 bits to make it aligned.
            .storeBits(new BitString(Buffer.from('00', 'hex'), 0, 2))
            .endCell()

        return [payload1, payload2]
    }
}
//
// export async function waitForTransaction(
//     walletContract: OpenedContract<WalletContractV4>,
//     seqno: number,
//     endpointName: string
// ) {
//     let currentSeqno = seqno
//
//     while (currentSeqno == seqno) {
//         console.log(`Waiting for transaction ${endpointName} to confirm...`)
//         await sleep(1500)
//         currentSeqno = await walletContract.getSeqno()
//     }
//     console.log(`Transaction ${endpointName} confirmed!`)
// }
//
// function sleep(ms: number) {
//     return new Promise((resolve) => setTimeout(resolve, ms))
// }

export const MIN_META_SYNTH_TONS = toNano('0.02')
export const MIN_META_SYNTH_JETTONS = toNano('0.1')

interface MetaSynthesizeParams {
    symbiosis: Symbiosis
    fee: TokenAmount
    from: string
    amountIn: TokenAmount
    poolChainId: ChainId
    evmAddress: string
    swapTokens: string[]
    secondSwapCallData: string
    secondDexRouter: string
    finalCallData: string
    finalReceiveSide: string
    finalOffset: number
    validUntil: number
}

export function buildMetaSynthesize(params: MetaSynthesizeParams): TonTransactionData {
    const {
        symbiosis,
        fee,
        from,
        amountIn,
        evmAddress,
        poolChainId,
        swapTokens,
        secondDexRouter,
        secondSwapCallData,
        finalReceiveSide,
        finalCallData,
        finalOffset,
        validUntil,
    } = params
    const tonPortal = symbiosis.config.chains.find((chain) => chain.id === amountIn.token.chainId)?.tonPortal
    if (!tonPortal) {
        throw new Error(`No TON portal for chain ${amountIn.token.chainId}`)
    }

    const synthesisAddress = symbiosis.synthesis(poolChainId).address
    const bridgeAddress = symbiosis.bridge(poolChainId).address

    const WTON_EVM = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'ton')

    const USDT_EVM = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'usdt')

    const tonTokenAddress = EVM_TO_TON[amountIn.token.address.toLowerCase()]
    if (!tonTokenAddress) {
        throw new Error('EVM address not found in EVM_TO_TON')
    }

    const metaSynthesizeBody = Bridge.metaSynthesizeMessage({
        stableBridgingFee: BigInt(fee.raw.toString()),
        token: Address.parse(tonTokenAddress), // simulate jetton for gas token TEP-161
        amount: BigInt(amountIn.raw.toString()),
        chain2Address: Buffer.from(evmAddress.slice(2), 'hex'),
        receiveSide: Buffer.from(synthesisAddress.slice(2), 'hex'),
        oppositeBridge: Buffer.from(bridgeAddress.slice(2), 'hex'),
        chainId: BigInt(poolChainId),
        revertableAddress: Buffer.from(evmAddress.slice(2), 'hex'), // evm this.to
        swapTokens: swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
        secondDexRouter: Buffer.from(secondDexRouter.slice(2), 'hex'),
        secondSwapCallData: Buffer.from(secondSwapCallData.slice(2), 'hex'),
        finalCallData: Buffer.from(finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
        finalReceiveSide: Buffer.from(finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
        finalOffset: BigInt(finalOffset),
    })

    if (WTON_EVM?.equals(amountIn.token)) {
        return {
            validUntil,
            messages: [
                {
                    address: tonPortal,
                    amount: amountIn.add(new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)).raw.toString(), // FIXME not possible to sum USDT and TON
                    payload: metaSynthesizeBody.toBoc().toString('base64'),
                },
            ],
        }
    } else if (USDT_EVM?.equals(amountIn.token)) {
        const cell = beginCell()
            .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
            .storeUint(0, 64) // query id
            .storeCoins(BigInt(amountIn.raw.toString())) // jetton amount
            .storeAddress(Address.parse(tonPortal)) // destination
            .storeAddress(Address.parse(from)) // response_destination for excesses of ton
            .storeBit(0) // null custom payload
            .storeCoins(toNano('0.05')) // forward amount - if >0, will send notification message
            .storeMaybeRef(metaSynthesizeBody)
            .endCell()

        return {
            validUntil,
            messages: [
                {
                    address: '', // [TODO]: Calc your own jetton wallet address to send jettons
                    amount: amountIn.add(new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)).raw.toString(), // FIXME not possible to sum USDT and TON
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        }
    }

    throw new Error('No TON transaction request. Unsupported token')
}

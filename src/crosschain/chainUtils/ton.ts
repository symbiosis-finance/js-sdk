import { Address, beginCell, Cell, Contract, toNano } from '@ton/core'
import { JettonMaster } from '@ton/ton'

import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { Token, TokenAmount } from '../../entities'
import { TonTransactionData } from '../types'
import { Error } from '../error'
import { parseUnits } from '@ethersproject/units'

export const TON_TOKEN_DECIMALS = 9

export const TON_REFERRAL_ADDRESS = Address.parse('UQD35aoXN2UbZ1ZrjjjKsLNH-ISdp5Lj42d_0Q_pllYmRth0')

export const TON_EVM_ADDRESS = '0xA4f1b5C2fC9b97d4238B3dE3487ccaE2c36dE07C'

const TON_ADDRESSES_MAP = [
    {
        evm: '0xA4f1b5C2fC9b97d4238B3dE3487ccaE2c36dE07C',
        ton: 'EQD8AErK5HbmnftlHQuk8bXC_JuX1COLPeNIfMriw23gfO3I', // TON
        stonFi: 'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c', // stonfi TON
    },
    {
        evm: '0x9328Eb759596C38a25f59028B146Fecdc3621Dfe',
        ton: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT
    },
    {
        evm: '0x678F2a82c73C69338a00d1Cf2BA8aB7887BD3293',
        ton: 'EQBh9XACT0B60U8Q48VnjyqCxzxpM4oA0c8rqKt4h70yk1V5', // UXLINK
    },
    {
        evm: '0x73f9a6D3AD10BaB08E6dbC7bEfa5e42b695F5400',
        ton: 'EQD-cvR0Nz6XAyRBvbhz-abTrRC6sI5tvHvvpeQraV9UAAD7', // CATI
    },
    {
        evm: '0x7eA393298D1077e19ec59F8e3FE8fe642738c08C', // TON testnet
        ton: 'EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4',
    },
    {
        evm: '0x46deec715e419a1f0f5959b5c8450894959d2dbf',
        ton: 'EQD73uqQJHKAg140YSlG3uxxXkGaHw9ZWbXIRQiUlZ0tv79a', // USDT testnet
    },
    {
        evm: '0x32cc2d7bc18283f40d20bb03e432cd603ac33ffc',
        ton: 'EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT', //NOT
    },
    {
        evm: '0xde78fc6b46c51048513f8e9a6d44060199c1bf0c',
        ton: 'EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS', // DOGS
    },
    {
        evm: '0xdf48a1e91b6410970fa3d5ffed3eed49e3cf08ff',
        ton: 'EQB420yQsZobGcy0VYDfSKHpG2QQlw-j1f_tPu1J488I__PX', // PX
    },
    {
        evm: '0x744a45f2b710aa4234b89adb630e99d79b01bd4f',
        ton: 'EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO', // Ston.fi
    },
    {
        evm: '0x0d2d353642cFFC051A2694C51B6C00e787EB4590',
        ton: 'EQDY2MzMJY_9OWm9UyQNLTU2Qs_8BRomlMUbbADnh-tFkLaU', // PINEYE
    },
]

export function getTonTokenAddress(address: string, isStonFi: boolean = false): string {
    const found = TON_ADDRESSES_MAP.find((item) => {
        return item.evm.toLowerCase() === address.toLowerCase()
    })

    if (!found) {
        throw new Error(`TON address was not found by evm address ${address}`)
    }

    // TON doesn't has contract address in TON, Stonfi use their own proxy contract
    if (found.evm === TON_EVM_ADDRESS && isStonFi && found.stonFi) {
        return found.stonFi
    }

    return found.ton
}

export function isTonChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.TON_MAINNET, ChainId.TON_TESTNET].includes(chainId)
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

export type BridgeConfig = {
    isPaused: boolean
    owner: Address
    admin: Address
    mpcAddress: Buffer
    externalIdContractCode: Cell
    tonAddress: Address
}

export const Opcodes = {
    EpSynthesize: 2048159929,
    EpMetaSynthesize: 1585287200,
}

export const EventIds = {
    MPCChanged: BigInt(3246037916),
    BurnCompleted: BigInt(1659197634),
    SetJettonThreshold: BigInt(3303282619),
    OracleRequest: BigInt(2067945553),
}

export class Bridge implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

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
}

export const MIN_META_SYNTH_TONS = toNano('0.02')
export const MIN_META_SYNTH_JETTONS = toNano('0.2')
export const MIN_SYNTH_TONS = toNano('0.015')
export const MIN_SYNTH_JETTONS = toNano('0.2')
export const NOTIFICATION_PAYMENT = toNano('0.05')

interface MetaSynthesizeParams {
    symbiosis: Symbiosis
    fee: TokenAmount
    from: string
    to: string
    revertableAddress: string
    amountIn: TokenAmount
    chainIdOut: ChainId
    swapTokens: string[]
    secondSwapCallData: string
    secondDexRouter: string
    finalCallData: string
    finalReceiveSide: string
    finalOffset: number
    validUntil: number
}

export function isWTon(symbiosis: Symbiosis, token: Token) {
    const wton = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'ton')
    if (!wton) {
        return false
    }
    return wton.equals(token)
}

export async function buildMetaSynthesize(params: MetaSynthesizeParams): Promise<TonTransactionData> {
    const {
        symbiosis,
        fee,
        from,
        to,
        revertableAddress,
        amountIn,
        chainIdOut,
        swapTokens,
        secondDexRouter,
        secondSwapCallData,
        finalReceiveSide,
        finalCallData,
        finalOffset,
        validUntil,
    } = params
    const tonChainConfig = symbiosis.config.chains.find((chain) => chain.id === amountIn.token.chainId)
    if (!tonChainConfig) {
        throw new Error(`No TON chain config for chain ${amountIn.token.chainId}`)
    }
    const tonPortal = tonChainConfig.tonPortal
    if (!tonPortal) {
        throw new Error(`No TON portal for chain ${amountIn.token.chainId}`)
    }

    const tonTokenAddress = getTonTokenAddress(amountIn.token.address)

    const metaSynthesizeBody = Bridge.metaSynthesizeMessage({
        stableBridgingFee: BigInt(fee.raw.toString()),
        token: Address.parse(tonTokenAddress), // simulate jetton for gas token TEP-161
        amount: BigInt(amountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'),
        receiveSide: Buffer.from(symbiosis.synthesis(chainIdOut).address.slice(2), 'hex'),
        oppositeBridge: Buffer.from(symbiosis.bridge(chainIdOut).address.slice(2), 'hex'),
        chainId: BigInt(chainIdOut),
        revertableAddress: Buffer.from(revertableAddress.slice(2), 'hex'),
        swapTokens: swapTokens.map((token) => Buffer.from(token.slice(2), 'hex')), // sTON, sWTON host chain tokens
        secondDexRouter: Buffer.from(secondDexRouter.slice(2), 'hex'),
        secondSwapCallData: Buffer.from(secondSwapCallData.slice(2), 'hex'),
        finalCallData: Buffer.from(finalCallData.slice(2), 'hex'), // metaBurnSyntheticToken host chain (synthesis.sol) hostchain (include extra swap on 3-rd chain)
        finalReceiveSide: Buffer.from(finalReceiveSide.slice(2), 'hex'), // synthesis host chain address
        finalOffset: BigInt(finalOffset),
    })

    const tonFee = new TokenAmount(amountIn.token, MIN_META_SYNTH_TONS)

    if (isWTon(symbiosis, amountIn.token)) {
        return {
            validUntil,
            messages: [
                {
                    address: tonPortal,
                    amount: amountIn.add(tonFee).raw.toString(),
                    payload: metaSynthesizeBody.toBoc().toString('base64'),
                },
            ],
        }
    } else {
        const tonTokenAddress = getTonTokenAddress(amountIn.token.address)
        const jettonMaster = JettonMaster.create(Address.parse(tonTokenAddress))

        const tonClient = await symbiosis.getTonClient()
        const provider = tonClient.provider(jettonMaster.address)

        const jettonWalletAddress = await jettonMaster.getWalletAddress(provider, Address.parse(from))

        const cell = beginCell()
            .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
            .storeUint(0, 64) // query id
            .storeCoins(BigInt(amountIn.raw.toString())) // jetton amount
            .storeAddress(Address.parse(tonPortal)) // destination
            .storeAddress(Address.parse(from)) // response_destination for excesses of ton
            .storeBit(0) // null custom payload
            .storeCoins(NOTIFICATION_PAYMENT) // forward amount - if >0, will send notification message
            .storeMaybeRef(metaSynthesizeBody)
            .endCell()

        return {
            validUntil,
            messages: [
                {
                    address: jettonWalletAddress.toString(),
                    amount: MIN_META_SYNTH_JETTONS.toString(),
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        }
    }
}

interface SynthesizeParams {
    symbiosis: Symbiosis
    fee: TokenAmount
    amountIn: TokenAmount
    chainIdOut: ChainId
    from: string
    to: string
    revertableAddress: string
    validUntil: number
}

export async function buildSynthesize(params: SynthesizeParams): Promise<TonTransactionData> {
    const { symbiosis, fee, from, amountIn, to, chainIdOut, validUntil, revertableAddress } = params
    const tonChainConfig = symbiosis.config.chains.find((chain) => chain.id === amountIn.token.chainId)
    if (!tonChainConfig) {
        throw new Error(`No TON chain config for chain ${amountIn.token.chainId}`)
    }
    const tonPortal = tonChainConfig.tonPortal
    if (!tonPortal) {
        throw new Error(`No TON portal for chain ${amountIn.token.chainId}`)
    }

    const tonTokenAddress = getTonTokenAddress(amountIn.token.address)

    const synthesizeMessage = Bridge.synthesizeMessage({
        stableBridgingFee: BigInt(fee.raw.toString()),
        token: Address.parse(tonTokenAddress),
        amount: BigInt(amountIn.raw.toString()),
        chain2Address: Buffer.from(to.slice(2), 'hex'),
        receiveSide: Buffer.from(symbiosis.synthesis(chainIdOut).address.slice(2), 'hex'),
        oppositeBridge: Buffer.from(symbiosis.bridge(chainIdOut).address.slice(2), 'hex'),
        revertableAddress: Buffer.from(revertableAddress.slice(2), 'hex'),
        chainId: BigInt(chainIdOut),
    })

    const tonFee = new TokenAmount(amountIn.token, MIN_SYNTH_TONS)

    if (isWTon(symbiosis, amountIn.token)) {
        return {
            validUntil,
            messages: [
                {
                    address: tonPortal,
                    amount: amountIn.add(tonFee).raw.toString(),
                    payload: synthesizeMessage.toBoc().toString('base64'),
                },
            ],
        }
    } else {
        const tonTokenAddress = getTonTokenAddress(amountIn.token.address)
        const jettonMaster = JettonMaster.create(Address.parse(tonTokenAddress))

        const tonClient = await symbiosis.getTonClient()
        const provider = tonClient.provider(jettonMaster.address)

        const jettonWalletAddress = await jettonMaster.getWalletAddress(provider, Address.parse(from))

        const cell = beginCell()
            .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
            .storeUint(0, 64) // query id
            .storeCoins(BigInt(amountIn.raw.toString())) // jetton amount
            .storeAddress(Address.parse(tonPortal)) // destination
            .storeAddress(Address.parse(from)) // response_destination for excesses of ton
            .storeBit(0) // null custom payload
            .storeCoins(NOTIFICATION_PAYMENT) // forward amount - if >0, will send notification message
            .storeMaybeRef(synthesizeMessage)
            .endCell()

        return {
            validUntil,
            messages: [
                {
                    address: jettonWalletAddress.toString(),
                    amount: MIN_SYNTH_JETTONS.toString(),
                    payload: cell.toBoc().toString('base64'),
                },
            ],
        }
    }
}

// TODO implement fee estimation
export function tonAdvisorMock(feeToken: Token) {
    let feeRaw = '0.1' // wton
    if (feeToken.symbol?.toLowerCase().includes('usdt')) {
        feeRaw = '0.5'
    }
    if (feeToken.symbol?.toLowerCase().includes('uxlink')) {
        feeRaw = '1'
    }
    if (feeToken.symbol?.toLowerCase().includes('cati')) {
        feeRaw = '1'
    }
    if (feeToken.symbol?.toLowerCase().includes('pineye')) {
        feeRaw = '1000'
    }
    return {
        fee: new TokenAmount(feeToken, parseUnits(feeRaw, feeToken.decimals).toString()),
        save: new TokenAmount(feeToken, '0'),
    }
}

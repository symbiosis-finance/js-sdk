import { Address, beginCell, Cell, Contract, toNano } from '@ton/core'
import { JettonMaster } from '@ton/ton'

import { ChainId } from '../../constants'
import { Symbiosis } from '../symbiosis'
import { Token, TokenAmount } from '../../entities'
import { TonTransactionData } from '../types'
import { Error } from '../error'
import { parseUnits } from '@ethersproject/units'

export const TON_TOKEN_DECIMALS = 9

const TON_ADDRESSES_MAP = [
    {
        evm: '0xA4f1b5C2fC9b97d4238B3dE3487ccaE2c36dE07C',
        ton: 'EQD8AErK5HbmnftlHQuk8bXC_JuX1COLPeNIfMriw23gfO3I', // TON
    },
    {
        evm: '0x9328Eb759596C38a25f59028B146Fecdc3621Dfe',
        ton: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', // USDT
    },
    {
        evm: '0x7eA393298D1077e19ec59F8e3FE8fe642738c08C', // TON testnet
        ton: 'EQCgXxcoCXhsAiLyeG5-o5MpjRB34Z7Fn44_6P5kJzjAjKH4',
    },
    {
        evm: '0x46deec715e419a1f0f5959b5c8450894959d2dbf',
        ton: 'EQD73uqQJHKAg140YSlG3uxxXkGaHw9ZWbXIRQiUlZ0tv79a', // USDT testnet
    },
]

const WTON_TOKEN = {
    decimals: TON_TOKEN_DECIMALS,
    name: 'Wrapped Toncoin',
    symbol: 'WTON',
    icons: {
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/11419.png',
    },
}

export type Option = { chainId: ChainId; bridge: string; wTon: Token; bridgeTonAddr: string }

export const NATIVE_TON_BRIDGE_OPTIONS: Option[] = [
    {
        chainId: ChainId.SEPOLIA_TESTNET,
        bridge: '0x3A1e6dA810637fb1c99fa0899b4F402A60E131D2',
        wTon: new Token({
            chainId: ChainId.SEPOLIA_TESTNET,
            address: '0x331f40cc27aC106e1d5242CE633dc6436626a6F8',
            ...WTON_TOKEN,
        }),
        bridgeTonAddr: 'Ef-56ZiqKUbtp_Ax2Qg4Vwh7yXXJCO8cNJAb229J6XXe4-aC',
    },
    {
        chainId: ChainId.BSC_MAINNET,
        bridge: '0x35D39bB2cbc51ce6c03f0306d0D8d56948b1f990',
        wTon: new Token({
            chainId: ChainId.BSC_MAINNET,
            address: '0x76A797A59Ba2C17726896976B7B3747BfD1d220f',
            ...WTON_TOKEN,
        }),
        bridgeTonAddr: 'Ef9NXAIQs12t2qIZ-sRZ26D977H65Ol6DQeXc5_gUNaUys5r',
    },
    {
        chainId: ChainId.ETH_MAINNET,
        bridge: '0x195A07D222a82b50DB84e8f47B71504D1E8C5fa2',
        wTon: new Token({
            chainId: ChainId.ETH_MAINNET,
            address: '0x582d872A1B094FC48F5DE31D3B73F2D9bE47def1',
            ...WTON_TOKEN,
        }),
        bridgeTonAddr: 'Ef_dJMSh8riPi3BTUTtcxsWjG8RLKnLctNjAM4rw8NN-xWdr',
    },
]

export function getTonTokenAddress(address: string) {
    const found = TON_ADDRESSES_MAP.find((item) => {
        return item.evm.toLowerCase() === address.toLowerCase()
    })
    if (!found) {
        throw new Error(`TON address was not found by evm address ${address}`)
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
export const MIN_META_SYNTH_JETTONS = toNano('0.1')
export const MIN_SYNTH_TONS = toNano('0.015')
export const MIN_SYNTH_JETTONS = toNano('0.1')
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

export function isUsdt(symbiosis: Symbiosis, token: Token) {
    const usdt = symbiosis
        .tokens()
        .find((token) => isTonChainId(token.chainId) && token.symbol?.toLowerCase() === 'usdt')
    if (!usdt) {
        return false
    }
    return usdt.equals(token)
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
    } else if (isUsdt(symbiosis, amountIn.token)) {
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

    throw new Error('No TON transaction request. Unsupported token')
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
    } else if (isUsdt(symbiosis, amountIn.token)) {
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

    throw new Error('No TON transaction request. Unsupported token')
}

export function tonAdvisorMock(feeToken: Token) {
    let feeRaw = '0.1' // wton
    if (feeToken.symbol?.toLowerCase().includes('usdt')) {
        feeRaw = '0.5'
    }
    return {
        fee: new TokenAmount(feeToken, parseUnits(feeRaw, feeToken.decimals).toString()),
        save: new TokenAmount(feeToken, '0'),
    }
}

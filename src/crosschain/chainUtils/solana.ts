import {
    AddressLookupTableAccount,
    Connection,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js'
import { ChainId } from '../../constants'
import { Token } from '../../entities'

export function isSolanaChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.SOLANA_MAINNET].includes(chainId)
}

const SOLANA_ADDRESSES_MAP = [
    {
        evm: '0x0000000000000000000000000000000000000003',
        solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    },
    {
        evm: '0x0000000000000000000000000000000000000004',
        solana: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', // TRUMP
    },
    {
        evm: '0x0000000000000000000000000000000000000005',
        solana: 'FUAfBo2jgks6gB4Z4LfZkqSZgzNucisEHqnNebaRxM1P', // MELANIA
    },
]

export const SOL_USDC = getSolanaToken({
    name: 'USDC',
    evmAddress: '0x0000000000000000000000000000000000000003', // according to ChainFlipAssetId
    cmcId: '3408',
})

export const SOLANA_SUPPORTED_TOKENS = [
    SOL_USDC,
    getSolanaToken({ name: 'TRUMP', evmAddress: '0x0000000000000000000000000000000000000004', cmcId: '35336' }),
    getSolanaToken({ name: 'MELANIA', evmAddress: '0x0000000000000000000000000000000000000005', cmcId: '35347' }),
]

export function getSolanaTokenAddress(evmAddress: string) {
    const token = SOLANA_ADDRESSES_MAP.find((token) => token.evm.toLowerCase() === evmAddress.toLowerCase())

    if (!token) {
        throw new Error(`Solana address was not found by evm address ${evmAddress}`)
    }

    return token?.solana
}

function getSolanaToken({
    name,
    decimals = 6,
    evmAddress,
    cmcId,
}: {
    name: string
    decimals?: number
    evmAddress: string
    cmcId: string
}) {
    const token = SOLANA_ADDRESSES_MAP.find((token) => token.evm.toLowerCase() === evmAddress.toLowerCase())

    if (!token) {
        throw new Error(`Solana address was not found by evm address ${evmAddress}`)
    }

    return new Token({
        name,
        symbol: name,
        address: evmAddress,
        chainId: ChainId.SOLANA_MAINNET,
        decimals,
        icons: {
            large: `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`,
            small: `https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`,
        },
    })
}

export function getSolanaConnection() {
    return new Connection('https://solana-rpc.publicnode.com')
}

const FEE_SOL_COLLECTOR = '7niUN8QFTN8V3y47fqLpAPs5Hq9T79BrSq8CAVjq6YJX'
const SOL_FEE_AMOUNT = 50000 // 0.00005 sol (9 decimals)

export async function addSolanaFee(from: string, instructions?: string) {
    if (!instructions) {
        throw new Error('Theres is no instructions in solana trade')
    }
    const connection = getSolanaConnection()
    const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: new PublicKey(from),
        toPubkey: new PublicKey(FEE_SOL_COLLECTOR),
        lamports: SOL_FEE_AMOUNT,
    })

    const txBuffer = Buffer.from(instructions, 'base64')
    const transaction = VersionedTransaction.deserialize(txBuffer)

    // Get Address Lookup Table
    const lookupTableAccount = await connection
        .getAddressLookupTable(transaction.message.addressTableLookups[0].accountKey)
        .then((res) => res.value as AddressLookupTableAccount)

    const message = TransactionMessage.decompile(transaction.message, {
        addressLookupTableAccounts: [lookupTableAccount],
    })

    message.instructions.unshift(transferSolInstruction)

    transaction.message = message.compileToV0Message([lookupTableAccount])

    return {
        instructions: Buffer.from(transaction.serialize()).toString('base64'),
        fee: SOL_FEE_AMOUNT,
    }
}

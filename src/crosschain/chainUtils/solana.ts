import {
    AddressLookupTableAccount,
    Connection,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from '@solana/web3.js'
import { ChainId } from '../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../entities'

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
    {
        evm: '0x0000000000000000000000000000000000000006',
        solana: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    },
    {
        evm: '0x0000000000000000000000000000000000000007',
        solana: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    },
    {
        evm: '0x0000000000000000000000000000000000000008',
        solana: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
    },
    {
        evm: '0x0000000000000000000000000000000000000009',
        solana: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
    },
    {
        evm: '0x0000000000000000000000000000000000000010',
        solana: 'GbbesPbaYh5uiAZSYNXTc7w9jty1rpg3P9L4JeN4LkKc', // TRX
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
    getSolanaToken({
        name: 'BONK',
        evmAddress: '0x0000000000000000000000000000000000000006',
        cmcId: '23095',
        decimals: 5,
    }),
    getSolanaToken({ name: 'WIF', evmAddress: '0x0000000000000000000000000000000000000007', cmcId: '28752' }),
    getSolanaToken({ name: 'RAY', evmAddress: '0x0000000000000000000000000000000000000008', cmcId: '8526' }),
    getSolanaToken({ name: 'JUP', evmAddress: '0x0000000000000000000000000000000000000009', cmcId: '29210' }),
    getSolanaToken({ name: 'TRX', evmAddress: '0x0000000000000000000000000000000000000010', cmcId: '1958' }),
]

export function getSolanaTokenAddress(evmAddress: string) {
    const token = SOLANA_ADDRESSES_MAP.find((token) => token.evm.toLowerCase() === evmAddress.toLowerCase())

    if (!token) {
        throw new Error(`Solana address was not found by evm address ${evmAddress}`)
    }

    return token.solana
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

const SOL_FEE_COLLECTOR = '7niUN8QFTN8V3y47fqLpAPs5Hq9T79BrSq8CAVjq6YJX'
const SOL_FEE_AMOUNT = 2000000 // 0.002 SOL (9 decimals)

export async function addSolanaFee(from: string, instructions?: string) {
    if (!instructions) {
        throw new Error('Theres is no instructions in solana trade')
    }
    const connection = getSolanaConnection()
    const transferSolInstruction = SystemProgram.transfer({
        fromPubkey: new PublicKey(from),
        toPubkey: new PublicKey(SOL_FEE_COLLECTOR),
        lamports: SOL_FEE_AMOUNT,
    })

    const txBuffer = Buffer.from(instructions, 'base64')
    const transaction = VersionedTransaction.deserialize(txBuffer)

    // Get Address Lookup Table
    const lookupTableAccounts = await Promise.all(
        transaction.message.addressTableLookups.map(async (lookup) => {
            const response = await connection.getAddressLookupTable(lookup.accountKey)
            return response.value as AddressLookupTableAccount
        })
    )

    const message = TransactionMessage.decompile(transaction.message, {
        addressLookupTableAccounts: lookupTableAccounts,
    })

    message.instructions.unshift(transferSolInstruction)

    transaction.message = message.compileToV0Message(lookupTableAccounts)

    return {
        instructions: Buffer.from(transaction.serialize()).toString('base64'),
        fee: new TokenAmount(GAS_TOKEN[ChainId.SOLANA_MAINNET], BigInt(SOL_FEE_AMOUNT)),
    }
}

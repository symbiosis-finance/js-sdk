import type { AddressLookupTableAccount } from '@solana/web3.js'
import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'

import { ChainId } from '../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../entities'

export function isSolanaChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.SOLANA_MAINNET].includes(chainId)
}

export const SOL_USDC = new Token({
    name: 'USDC',
    symbol: 'USDC',
    address: '0x0000000000000000000000000000000000000003',
    chainId: ChainId.SOLANA_MAINNET,
    decimals: 6,
    icons: {
        large: `https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png`,
        small: `https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png`,
    },
    attributes: {
        solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
})

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

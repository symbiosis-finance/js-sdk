import { ChainId } from '../../constants'

export function isSolanaChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.SOLANA_MAINNET].includes(chainId)
}

const SOLANA_ADDRESSES_MAP = [
    {
        evm: '0x0000000000000000000000000000000000000003',
        solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    },
]

export function getSolanaTokenAddress(evmAddress: string) {
    const token = SOLANA_ADDRESSES_MAP.find((token) => token.evm.toLowerCase() === evmAddress.toLowerCase())

    if (!token) {
        throw new Error(`Solana address was not found by evm address ${evmAddress}`)
    }

    return token?.solana
}

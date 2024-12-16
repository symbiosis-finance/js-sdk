import { ChainId } from '../../constants'

export function isSolanaChainId(chainId: ChainId | undefined) {
    if (!chainId) return false
    return [ChainId.SOLANA_MAINNET].includes(chainId)
}

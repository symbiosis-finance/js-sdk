import { ChainId } from '../../constants'

export function isQuaiChainId(chainId: ChainId | undefined): boolean {
    if (!chainId) return false
    return chainId === ChainId.QUAI_MAINNET
}

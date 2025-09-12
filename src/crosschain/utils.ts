import { ChainId } from '../constants'
import { Token } from '../entities'

export function isUseOneInchOnly(tokenIn: Token, tokenOut: Token): boolean {
    const chainsForOneInchUsageOnly = [
        ChainId.BTC_MAINNET,
        ChainId.TRON_MAINNET,
        ChainId.BASE_MAINNET,
        ChainId.ARBITRUM_MAINNET,
        ChainId.ETH_MAINNET,
        ChainId.BSC_MAINNET,
    ]

    return [tokenIn.chainId, tokenOut.chainId].every((i) => chainsForOneInchUsageOnly.includes(i))
}

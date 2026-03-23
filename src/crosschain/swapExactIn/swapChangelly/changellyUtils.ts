import { Token } from '../../../entities'
import { ChangellyError } from '../../sdkError'
import type { Symbiosis } from '../../symbiosis'
import { isSolanaChainId } from '../../chainUtils/solana'
import { CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID, CHANGELLY_TRANSIT_TOKEN_MAP } from './constants'

export async function resolveChangellyTicker(symbiosis: Symbiosis, token: Token): Promise<string> {
    // For Solana SPL tokens, the mint address is stored in solAddress, not address
    const address = isSolanaChainId(token.chainId) ? (token.solAddress || token.address) : token.address
    const key = token.isNative
        ? `${token.chainId}:native`
        : `${token.chainId}:${isSolanaChainId(token.chainId) ? address : address.toLowerCase()}`

    // Fast path: hardcoded map
    const ticker = CHANGELLY_TRANSIT_TOKEN_MAP.get(key)
    if (ticker) return ticker

    // Slow path: fetch from Changelly API (will be removed after onchain swap)
    const fullMap = await getFullCurrencyMap(symbiosis)
    const fallbackTicker = fullMap.get(key)
    if (fallbackTicker) return fallbackTicker

    throw new ChangellyError(`Changelly does not support ${token.symbol} on chain ${token.chainId}`)
}

let fullMapPromise: Promise<Map<string, string>> | null = null
let fullMapTimestamp: number | null = null
const FULL_MAP_TTL_MS = 60 * 60 * 1000 // 1 hour

// TODO: Remove after onchain swap to transit token
async function getFullCurrencyMap(symbiosis: Symbiosis): Promise<Map<string, string>> {
    const isExpired = !fullMapTimestamp || Date.now() - fullMapTimestamp > FULL_MAP_TTL_MS
    if (fullMapPromise && !isExpired) {
        return fullMapPromise
    }
    fullMapTimestamp = Date.now()
    fullMapPromise = symbiosis.changelly
        .getCurrenciesFull()
        .then((currencies) => {
            const map = new Map<string, string>()
            for (const currency of currencies) {
                if (!currency.enabled || !currency.blockchain) continue
                const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[currency.blockchain]
                if (chainId === undefined) continue

                if (currency.contractAddress) {
                    const contractKey = isSolanaChainId(chainId)
                        ? currency.contractAddress
                        : currency.contractAddress.toLowerCase()
                    map.set(`${chainId}:${contractKey}`, currency.ticker)
                } else {
                    map.set(`${chainId}:native`, currency.ticker)
                }
            }
            return map
        })
        .catch((error) => {
            fullMapPromise = null
            fullMapTimestamp = null
            throw error
        })
    return fullMapPromise
}

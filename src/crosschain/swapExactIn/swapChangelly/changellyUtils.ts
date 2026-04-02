import { Token } from '../../../entities'
import { ChangellyTickerNotFoundError } from '../../sdkError'
import type { Symbiosis } from '../../symbiosis'
import { isSolanaChainId } from '../../chainUtils/solana'
import { isTonChainId } from '../../chainUtils/ton'
import { isTronChainId } from '../../chainUtils/tron'
import { CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID, CHANGELLY_TICKER_MAP } from './constants'

export function buildChangellyKey(token: Token): string {
    if (token.isNative) return `${token.chainId}:native`

    if (isSolanaChainId(token.chainId)) {
        return `${token.chainId}:${token.solAddress}`
    }
    if (isTonChainId(token.chainId)) {
        return `${token.chainId}:${token.tonAddress}`
    }

    return `${token.chainId}:${token.address.toLowerCase()}`
}

export async function resolveChangellyTicker(symbiosis: Symbiosis, token: Token): Promise<string> {
    const key = buildChangellyKey(token)

    // Fast path: hardcoded map
    const ticker = CHANGELLY_TICKER_MAP.get(key)
    if (ticker) return ticker

    // Slow path: fetch full currency list from Changelly API (covers tokens not in static map)
    const fullMap = await getFullCurrencyMap(symbiosis)
    const fallbackTicker = fullMap.get(key)
    if (fallbackTicker) return fallbackTicker

    throw new ChangellyTickerNotFoundError(`Changelly does not support ${token.symbol} on chain ${token.chainId}`)
}

const FULL_MAP_TTL_S = 60 * 60 // 1 hour

async function getFullCurrencyMap(symbiosis: Symbiosis): Promise<Map<string, string>> {
    return symbiosis.cache.get(
        ['changellyFullCurrencyMap'],
        async () => {
            const currencies = await symbiosis.changelly.getCurrenciesFull()
            const map = new Map<string, string>()
            for (const currency of currencies) {
                if (!currency.enabled || !currency.blockchain) continue
                const chainId = CHANGELLY_BLOCKCHAIN_TO_CHAIN_ID[currency.blockchain]
                if (chainId === undefined) continue

                if (currency.contractAddress) {
                    const contractKey =
                        isSolanaChainId(chainId) || isTonChainId(chainId) || isTronChainId(chainId)
                            ? currency.contractAddress
                            : currency.contractAddress.toLowerCase()
                    map.set(`${chainId}:${contractKey}`, currency.ticker)
                } else {
                    map.set(`${chainId}:native`, currency.ticker)
                }
            }
            return map
        },
        FULL_MAP_TTL_S
    )
}

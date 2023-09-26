import type { ConfigName } from '../../symbiosis'
import mainnet from './mainnet.json'
import testnet from './testnet.json'
import dev from './dev.json'
import bridge from './bridge.json'
import { Error, ErrorCode } from '../../error'
import { ConfigCacheData, Id, OmniPoolInfo, TokenInfo } from './builder'
import { ChainId } from '../../../constants'
import { Token, wrappedToken } from '../../../entities'
import { BigNumber } from 'ethers'
import { OmniPoolConfig } from '../../types'

export class ConfigCache {
    private readonly cache: ConfigCacheData

    public constructor(configName: ConfigName) {
        if (configName === 'mainnet') {
            this.cache = mainnet
        } else if (configName === 'testnet') {
            this.cache = testnet
        } else if (configName === 'dev') {
            this.cache = dev
        } else if (configName === 'bridge') {
            this.cache = bridge
        } else {
            throw new Error('Unknown config name')
        }
    }

    public tokens(): Token[] {
        return this.cache.tokens.map((attributes) => {
            return new Token(attributes)
        })
    }

    public getRepresentation(token: Token, chainId: ChainId): Token | undefined {
        if (token.isSynthetic) {
            const original = this.getOriginalToken(token)
            if (original?.chainId !== chainId) {
                return
            }
            return original
        }

        return this.getSynthTokens(token).find((i) => i.chainId === chainId)
    }

    public getTokenThreshold(token: Token): BigNumber {
        const tokenInfo = this.getTokenInfoByToken(token)
        const type = token.isSynthetic ? 'Synthesis' : 'Portal'

        const threshold = this.cache.thresholds.find((i) => {
            return i.tokenId === tokenInfo.id && i.type === type
        })
        if (!threshold) {
            throw new Error(`There is no threshold for token ${token.address}`)
        }

        return BigNumber.from(threshold.value)
    }

    public getOmniPoolByConfig(omniPoolConfig: OmniPoolConfig): OmniPoolInfo | undefined {
        return this.cache.omniPools.find((i) => {
            return (
                i.address.toLowerCase() === omniPoolConfig.address.toLowerCase() && i.chainId === omniPoolConfig.chainId
            )
        })
    }

    public getOmniPoolById(id: Id): OmniPoolInfo | undefined {
        return this.cache.omniPools.find((i) => i.id === id)
    }

    // FIXME
    // It works correctly if the `token` in ONLY ONE pool
    // If there are more than one pool then FIRST pool will be selected
    public getOmniPoolByToken(token: Token): OmniPoolInfo | undefined {
        let synths: Token[]
        if (token.isSynthetic) {
            synths = [token]
        } else {
            synths = this.getSynthTokens(token)
        }

        const ids = synths.map((i) => {
            return this.getTokenInfoByToken(i).id
        })

        return this.cache.omniPools.find((pool) => {
            return pool.tokens.find((i) => {
                return ids.includes(i.tokenId)
            })
        })
    }

    public getOmniPoolTokenIndex(omniPoolConfig: OmniPoolConfig, token: Token): number {
        const omniPool = this.getOmniPoolByConfig(omniPoolConfig)
        if (!omniPool) {
            throw new Error(`getOmniPoolIndex: cannot find omniPoolByConfig ${omniPoolConfig}`)
        }

        const tokenInfo = this.getTokenInfoByToken(token)

        const found = omniPool.tokens.find((pool) => {
            return pool.tokenId === tokenInfo.id
        })

        if (found === undefined) {
            throw new Error(
                `There is no token ${tokenInfo.address} in omniPool ${omniPool.address}`,
                ErrorCode.NO_TRANSIT_TOKEN
            )
        }

        return found.index
    }

    public getOmniPoolTokens(omniPoolConfig: OmniPoolConfig): Token[] {
        const pool = this.getOmniPoolByConfig(omniPoolConfig)
        if (!pool) {
            throw new Error('Cannot find omniPool')
        }
        return pool.tokens.map((i) => {
            const tokenInfo = this.getTokenInfoById(i.tokenId)
            return new Token(tokenInfo)
        })
    }

    // PRIVATE

    private getTokenInfoById(id: Id): TokenInfo {
        const tokenInfo = this.cache.tokens.find((i) => i.id === id)

        if (!tokenInfo) {
            throw new Error(`Can't get tokenInfo for id ${id}`)
        }

        return tokenInfo
    }

    private getTokenInfoByToken(token: Token): TokenInfo {
        const found = this.cache.tokens.find((i) => {
            return (
                i.address.toLowerCase() === token.address.toLowerCase() &&
                i.chainId === token.chainId &&
                i.chainFromId === token.chainFromId
            )
        })

        if (!found) {
            throw new Error(`Can't get tokenInfo by token ${token.address} ${token.chainId}`)
        }

        return found
    }

    private getOriginalToken(token: Token): Token | undefined {
        if (!token.isSynthetic) {
            return
        }
        const tokenInfo = this.getTokenInfoByToken(token)
        if (tokenInfo.originalId === undefined) {
            return
        }
        const original = this.getTokenInfoById(tokenInfo.originalId)
        return new Token(original)
    }

    private getSynthTokens(token: Token): Token[] {
        if (token.isSynthetic) {
            return []
        }
        const wrapped = wrappedToken(token)
        const tokenInfo = this.getTokenInfoByToken(wrapped)
        return this.cache.tokens
            .filter((i) => {
                return i.originalId === tokenInfo.id
            })
            .map((i) => {
                return new Token(i)
            })
    }
}

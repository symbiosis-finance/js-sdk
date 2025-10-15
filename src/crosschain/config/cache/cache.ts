import type { ConfigName } from '../../symbiosis.ts'
import mainnet from './mainnet.json' with { type: 'json' }
import testnet from './testnet.json' with { type: 'json' }
import dev from './dev.json' with { type: 'json' }
import beta from './beta.json' with { type: 'json' }
import { Error, ErrorCode } from '../../error.ts'
import { ConfigCacheData, Id, OmniPoolInfo, TokenInfo } from './builder.ts'
import { ChainId } from '../../../constants.ts'
import { Token, wrappedToken } from '../../../entities/index.ts'
import { OmniPoolConfig } from '../../types.ts'

export class ConfigCache {
    private readonly data: ConfigCacheData

    public constructor(configName: ConfigName | ConfigCacheData) {
        if (configName === 'mainnet') {
            this.data = mainnet as ConfigCacheData
        } else if (configName === 'testnet') {
            this.data = testnet as ConfigCacheData
        } else if (configName === 'dev') {
            this.data = dev as ConfigCacheData
        } else if (configName === 'beta') {
            this.data = beta as ConfigCacheData
        } else if (Object.prototype.hasOwnProperty.call(configName, 'tokens')) {
            this.data = configName
        } else {
            throw new Error('Unknown config name')
        }
    }

    public tokens(): Token[] {
        return this.data.tokens.map((attributes) => {
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

    public getOmniPoolByConfig(omniPoolConfig: OmniPoolConfig): OmniPoolInfo | undefined {
        return this.data.omniPools.find((i) => {
            return (
                i.address.toLowerCase() === omniPoolConfig.address.toLowerCase() && i.chainId === omniPoolConfig.chainId
            )
        })
    }

    public getOmniPoolById(id: Id): OmniPoolInfo | undefined {
        return this.data.omniPools.find((i) => i.id === id)
    }

    // It works correctly if the `token` in ONE pool ONLY
    // If there are more than one pool then FIRST pool will be selected
    public getOmniPoolByToken(token: Token): OmniPoolInfo | undefined {
        let synths: Token[]
        if (token.isSynthetic) {
            synths = [token]
        } else {
            synths = this.getSynthTokens(token)
        }
        if (synths.length === 0) {
            synths = [token]
        }

        const ids = synths.map((i) => {
            return this.getTokenInfoByToken(i).id
        })

        return this.data.omniPools.find((pool) => {
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
                `getOmniPoolTokenIndex: There is no token ${tokenInfo.address} in omniPool ${omniPool.address}`,
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

    public getTokenInfoById(id: Id): TokenInfo {
        const tokenInfo = this.data.tokens.find((i) => i.id === id)

        if (!tokenInfo) {
            throw new Error(`Can't get tokenInfo for id ${id}`)
        }

        return tokenInfo
    }

    // --- PRIVATE ---

    private getTokenInfoByToken(token: Token): TokenInfo {
        const found = this.data.tokens.find((i) => {
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
        return this.data.tokens
            .filter((i) => {
                return i.originalId === tokenInfo.id
            })
            .map((i) => {
                return new Token(i)
            })
    }
}

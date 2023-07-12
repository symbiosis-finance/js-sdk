import type { ConfigName } from '../../symbiosis'
import mainnet from './mainnet.json'
import testnet from './testnet.json'
import { Error } from '../../error'
import { ConfigCacheData, Id, OmniPoolInfo, TokenInfo } from './builder'
import { ChainId } from '../../../constants'
import { Token } from '../../../entities'
import { BigNumber } from 'ethers'
import { OmniPoolConfig } from '../../types'

export class ConfigCache {
    private readonly cache: ConfigCacheData

    public constructor(configName: ConfigName) {
        if (configName === 'mainnet') {
            this.cache = mainnet
        } else if (configName === 'testnet') {
            this.cache = testnet
        } else {
            throw new Error('Unknown config name')
        }
    }

    public tokens(): Token[] {
        return this.cache.tokens.map((attributes) => {
            return new Token(attributes)
        })
    }

    public findToken(token: Token): TokenInfo | undefined {
        return this.cache.tokens.find((i) => {
            return i.address.toLowerCase() === token.address.toLowerCase() && i.chainId === token.chainId
        })
    }

    public getToken(id: Id): TokenInfo | undefined {
        return this.cache.tokens.find((i) => i.id === id)
    }

    public getRepresentation(token: Token, chainId: ChainId): Token | undefined {
        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            return
        }
        if (!tokenInfo.pair) {
            return
            // throw new Error(`There is no pair for token ${tokenInfo.id}`)
        }

        const rep = this.getToken(tokenInfo.pair)
        if (!rep) {
            throw new Error(
                `Can't get rep for token ${token.symbol}(${token.address}) on chain ${chainId}. TokenId=${tokenInfo.pair}`
            )
        }
        if (rep.chainId !== chainId) {
            return
        }

        return new Token(rep)
    }

    public getTokenThreshold(token: Token): BigNumber {
        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            throw new Error(`Cannot find token ${token.address}`)
        }
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

    public getOmniPoolByToken(token: Token): OmniPoolInfo | undefined {
        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            throw new Error(`getOmniPoolByToken: cannot find token ${token.address}`)
        }

        return this.cache.omniPools.find((pool) => {
            return pool.tokens.find((i) => {
                return i.tokenId === tokenInfo.id
            })
        })
    }

    public getOmniPoolTokenIndex(omniPoolConfig: OmniPoolConfig, token: Token): number {
        const omniPool = this.getOmniPoolByConfig(omniPoolConfig)
        if (!omniPool) {
            throw new Error(`getOmniPoolIndex: cannot find omniPoolByConfig ${omniPoolConfig}`)
        }

        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            throw new Error(`getOmniPoolIndex: cannot find token ${token.address}`)
        }

        const position = omniPool.tokens.find((pool) => {
            return pool.tokenId === tokenInfo.id
        })

        if (position === undefined) {
            throw new Error(`There is no token ${tokenInfo.address} in omniPool ${omniPool.address}`)
        }

        return position.index
    }
}

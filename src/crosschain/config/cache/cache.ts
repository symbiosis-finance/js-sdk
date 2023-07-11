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

    public findToken(token: Token): TokenInfo | undefined {
        return this.cache.tokens.find((i) => {
            return i.address.toLowerCase() === token.address.toLowerCase() && i.chainId === token.chainId
        })
    }

    public findOmniPool(omniPoolConfig: OmniPoolConfig): OmniPoolInfo | undefined {
        return this.cache.omniPools.find((i) => {
            return (
                i.address.toLowerCase() === omniPoolConfig.address.toLowerCase() && i.chainId === omniPoolConfig.chainId
            )
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
            throw new Error(`There is no pair for token ${tokenInfo.id}`)
        }

        const rep = this.getToken(tokenInfo.pair)
        if (!rep || rep.chainId !== chainId) {
            throw new Error(`Can't get rep ${tokenInfo.pair}`)
        }

        return new Token(rep)
    }

    public getTokenThreshold(token: Token, type: 'Portal' | 'Synthesis'): BigNumber {
        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            throw new Error(`Cannot find token ${token.address}`)
        }

        const threshold = this.cache.thresholds.find((i) => {
            return i.tokenId === tokenInfo.id && i.type === type
        })
        if (!threshold) {
            throw new Error(`There is no threshold for token ${token.address}`)
        }

        return BigNumber.from(threshold.value)
    }

    public getOmniPoolIndex(token: Token, omniPoolConfig: OmniPoolConfig): number {
        const tokenInfo = this.findToken(token)
        if (!tokenInfo) {
            throw new Error(`Cannot find token ${token.address}`)
        }

        const omniPool = this.findOmniPool(omniPoolConfig)
        if (!omniPool) {
            throw new Error(`Cannot find omniPool ${omniPoolConfig}`)
        }

        if (tokenInfo.omniPoolId !== omniPool.id) {
            throw new Error(`OmniPoolId doesn't match`)
        }

        if (!tokenInfo.omniPoolIndex) {
            throw new Error(`There is no token in omniPool`)
        }

        return tokenInfo.omniPoolIndex
    }
}

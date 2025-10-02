import TronWeb from 'tronweb'
import { COINGECKO_GAS_TOKEN_IDS, COINGECKO_PLATFORMS } from './constants'
import { GAS_TOKEN, Token, TokenAmount, WETH } from '../../entities'
import { isSolanaChainId, isTonChainId, isTronToken } from '../chainUtils'
import { Cache } from '../cache'

export class CoinGecko {
    #apiUrl: string
    #advisorUrl: string
    #cache: Cache

    static TOKEN_PRICE_PATH = '/api/v3/simple/token_price/'
    static PRICE_PATH = '/api/v3/simple/price/'
    static DEFAULT_COINGECKO_API_URL = 'https://api.coingecko.com'
    static DEFAULT_ADVISOR_URL = 'https://api.symbiosis.finance/calculations/v1/token/price'
    static PLATFORMS = COINGECKO_PLATFORMS
    static GAS_TOKEN_IDS = COINGECKO_GAS_TOKEN_IDS

    constructor(
        apiUrl: string = CoinGecko.DEFAULT_COINGECKO_API_URL,
        advisorUrl: string = CoinGecko.DEFAULT_ADVISOR_URL,
        cache: Cache = new Cache()
    ) {
        this.#apiUrl = apiUrl
        this.#advisorUrl = advisorUrl
        this.#cache = cache
    }

    async getTokenPriceFromAdvisor(token: Token): Promise<number> {
        const isWrappedToken = WETH[token.chainId].equals(token)
        const isGasToken = GAS_TOKEN[token.chainId].equals(token)

        const address = isWrappedToken || isGasToken ? '' : token.address
        const raw = JSON.stringify([
            {
                address,
                chain_id: token.chainId,
            },
        ])
        const myHeaders = new Headers()
        myHeaders.append('Content-Type', 'application/json')
        const response = await fetch(this.#advisorUrl, {
            method: 'POST',
            body: raw,
            headers: myHeaders,
        })

        if (!response.ok) {
            const text = await response.text()
            const json = JSON.parse(text)
            throw new Error(`Advisor: failed to get token price: ${json.message ?? text}`)
        }

        const json = await response.json()

        const price = json[0]['price']
        if (!price) {
            throw new Error(`Advisor: unknown price for token ${token.chainId}.${token.address}`)
        }
        return price
    }

    async getGasTokenPrice(token: Token): Promise<number> {
        const { chainId } = token
        const tokenId = CoinGecko.GAS_TOKEN_IDS[chainId]
        if (!tokenId) {
            throw Error(`CoinGecko: cannot find gas tokenId for chain ${chainId}`)
        }
        const vs = 'usd'
        const url = new URL(CoinGecko.PRICE_PATH, this.#apiUrl)
        url.searchParams.set('ids', tokenId)
        url.searchParams.set('vs_currencies', vs)

        const response = await fetch(url.toString())

        if (!response.ok) {
            const body = await response.text()
            throw Error(`CoinGecko: gas token price response: ${body}`)
        }

        const json = await response.json()

        if (!json[tokenId]) {
            throw Error(`CoinGecko: no price for token ${tokenId}`)
        }

        return parseFloat(json[tokenId][vs])
    }

    async getTokenPrice(token: Token): Promise<number> {
        const platform = CoinGecko.PLATFORMS[token.chainId]
        if (!platform) {
            throw Error(`CoinGecko: cannot find asset platform for chain ${token.chainId}`)
        }

        let address = token.address.toLowerCase()
        if (isTronToken(token)) {
            address = TronWeb.address.fromHex(address)
        } else if (isTonChainId(token.chainId)) {
            address = token.tonAddress
        } else if (isSolanaChainId(token.chainId)) {
            address = token.solAddress
        }

        const vs = 'usd'
        const url = new URL(CoinGecko.TOKEN_PRICE_PATH + platform, this.#apiUrl)
        url.searchParams.set('contract_addresses', address)
        url.searchParams.set('vs_currencies', vs)

        const response = await fetch(url.toString())

        if (!response.ok) {
            const body = await response.text()
            throw Error(`CoinGecko: token price response: ${body}`)
        }

        const json = await response.json()

        if (!json[address]) {
            throw Error(`CoinGecko: no price for token ${address}`)
        }

        return parseFloat(json[address][vs])
    }

    async getTokenPriceUsd(token: Token) {
        try {
            return await this.getTokenPriceFromAdvisor(token)
        } catch (e) {
            const isWrappedToken = WETH[token.chainId].equals(token)
            const isGasToken = GAS_TOKEN[token.chainId].equals(token)

            if (isGasToken || isWrappedToken) {
                return this.getGasTokenPrice(token)
            }

            return this.getTokenPrice(token)
        }
    }

    async getTokenPriceCached(token: Token) {
        return this.#cache.get(
            ['getTokenPriceUsd', token.chainId.toString(), token.address],
            () => this.getTokenPriceUsd(token),
            600, // 10 minutes,
            true // cache exceptions
        )
    }

    static getTokenAmountUsd(tokenAmount: TokenAmount, price: number): number {
        return parseFloat((parseFloat(tokenAmount.toSignificant()) * price).toFixed(2))
    }
}

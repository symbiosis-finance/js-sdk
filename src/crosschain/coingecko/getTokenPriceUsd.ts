import TronWeb from 'tronweb'
import { COINGECKO_GAS_TOKEN_IDS, COINGECKO_PLATFORMS } from './constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../entities'
import { getTonTokenAddress, isBtcChainId, isSolanaChainId, isTonChainId, isTronToken } from '../chainUtils'

const getTokenPriceFromAdvisor = async (token: Token): Promise<number> => {
    const address = token.equals(GAS_TOKEN[token.chainId]) ? '' : token.address
    const raw = JSON.stringify([
        {
            address,
            chain_id: token.chainId,
        },
    ])
    const myHeaders = new Headers()
    myHeaders.append('Content-Type', 'application/json')
    const response = await fetch(`https://api.symbiosis.finance/calculations/v1/token/price`, {
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

const getGasTokenPrice = async (token: Token): Promise<number> => {
    const { chainId } = token
    const tokenId = COINGECKO_GAS_TOKEN_IDS[chainId]
    if (!tokenId) {
        console.error('CoinGecko: cannot find tokenId')
        return 0
    }
    const vs = 'usd'
    const API_URL = 'https://api.coingecko.com'
    const url = new URL(`/api/v3/simple/price`, API_URL)
    url.searchParams.set('ids', tokenId)
    url.searchParams.set('vs_currencies', vs)

    const response = await fetch(url.toString())

    if (!response.ok) {
        console.error('CoinGecko: failed to get gas token price')
        return 0
    }

    const json = await response.json()

    if (!json[tokenId]) {
        console.error('CoinGecko: cannot find address')
        return 0
    }

    return parseFloat(json[tokenId][vs])
}

const getTokenPrice = async (token: Token, map?: Map<string, string>): Promise<number> => {
    const newAddress = map?.get(token.address)
    if (newAddress) {
        token = new Token({
            address: newAddress,
            chainId: token.chainId,
            decimals: token.decimals,
        })
    }
    const platform = COINGECKO_PLATFORMS[token.chainId]
    if (!platform) {
        console.error('CoinGecko: cannot find asset platform')
        return 0
    }

    let address = token.address.toLowerCase()
    if (isTronToken(token)) {
        address = TronWeb.address.fromHex(address)
    } else if (isTonChainId(token.chainId)) {
        address = getTonTokenAddress(address)
    } else if (isSolanaChainId(token.chainId) && token.attributes?.solana) {
        address = token.attributes.solana
    }

    const vs = 'usd'
    const API_URL = 'https://api.coingecko.com'
    const url = new URL(`/api/v3/simple/token_price/${platform}`, API_URL)
    url.searchParams.set('contract_addresses', address)
    url.searchParams.set('vs_currencies', vs)

    const response = await fetch(url.toString())

    if (!response.ok) {
        console.error('CoinGecko: failed to get token price')
        return 0
    }

    const json = await response.json()

    if (!json[address]) {
        console.error('CoinGecko: cannot find address')
        return 0
    }

    return parseFloat(json[address][vs])
}

export const getTokenPriceUsd = async (token: Token, map?: Map<string, string>) => {
    try {
        return await getTokenPriceFromAdvisor(token)
    } catch (e) {
        if (token.isNative || token.equals(GAS_TOKEN[token.chainId]) || isBtcChainId(token.chainId)) {
            return getGasTokenPrice(token)
        }

        return getTokenPrice(token, map)
    }
}

export const getTokenAmountUsd = (tokenAmount: TokenAmount, price: number): number => {
    return parseFloat((parseFloat(tokenAmount.toSignificant()) * price).toFixed(2))
}

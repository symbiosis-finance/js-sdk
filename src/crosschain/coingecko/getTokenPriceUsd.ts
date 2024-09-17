import TronWeb from 'tronweb'
import { COINGECKO_GAS_TOKEN_IDS, COINGECKO_PLATFORMS } from './constants'
import { Token, TokenAmount } from '../../entities'
import { isTronToken } from '../tron'
import { isBtc } from '../utils'

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
    let price = 0

    if (token.isNative || isBtc(token.chainId)) {
        price = await getGasTokenPrice(token)
    } else {
        price = await getTokenPrice(token, map)
    }

    return price
}

export const getTokenAmountUsd = (tokenAmount: TokenAmount, price: number): number => {
    return parseFloat((parseFloat(tokenAmount.toSignificant()) * price).toFixed(2))
}

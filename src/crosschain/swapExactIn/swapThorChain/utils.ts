import { AddressType, getAddressInfo, validate } from 'bitcoin-address-validation'
import { BigNumber } from 'ethers'
import fetch from 'isomorphic-unfetch'

import { ChainId } from '../../../constants'
import { GAS_TOKEN, Token, TokenAmount } from '../../../entities'
import { getMinAmount, isTronChainId, tronAddressToEvm } from '../../chainUtils'
import type { Cache } from '../../cache'
import { ThorChainError } from '../../sdkError'
import type { Address, EvmAddress, TronAddress } from '../../types'
import TronWeb from 'tronweb'

export const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

// https://gateway.liquify.com/chain/thorchain_api/thorchain/doc
const thorApiUrl = 'https://gateway.liquify.com/chain/thorchain_api/thorchain'

export type ThorQuote = {
    memo: string
    amountOut: TokenAmount
    amountOutMin: TokenAmount
    router: Address
    expiry: string
    fees: {
        asset: string
        total: string
    }
}

type ThorPool = {
    asset: string
    status: 'Available' | 'Staged'
    pending_inbound_asset: string
    pending_inbound_rune: string
    balance_asset: string
    balance_rune: string
    pool_units: string
    LP_units: string
    synth_units: string
    synth_supply: string
    savers_depth: string
    savers_units: string
    synth_mint_paused: false
    synth_supply_remaining: string
    loan_collateral: string
    loan_cr: string
    derived_depth_bps: string
}

const THOR_CHAIN_MAP: Partial<Record<ChainId, string>> = {
    [ChainId.AVAX_MAINNET]: 'AVAX',
    [ChainId.ETH_MAINNET]: 'ETH',
    [ChainId.BSC_MAINNET]: 'BSC',
    [ChainId.TRON_MAINNET]: 'TRON',
}

function toThorChain(chainId: ChainId): string {
    const chain = THOR_CHAIN_MAP[chainId]
    if (!chain) {
        throw new ThorChainError(`Unknown chain: ${chainId}`)
    }
    return chain
}

// the source asset amount in 1e8 decimals
function toThorToken(token: Token): string {
    const chain = toThorChain(token.chainId)
    let tokenAddress: EvmAddress | TronAddress = token.address as EvmAddress
    if (isTronChainId(token.chainId)) {
        tokenAddress = TronWeb.address.fromHex(tokenAddress) as TronAddress
    }
    return `${chain}.${token.symbol}-${tokenAddress.toUpperCase()}`
}

function toThorAmount(tokenAmount: TokenAmount): BigNumber {
    const tokenDecimals = BigNumber.from(10).pow(tokenAmount.token.decimals)
    const thorDecimals = BigNumber.from(10).pow(8)
    return BigNumber.from(tokenAmount.raw.toString()).mul(thorDecimals).div(tokenDecimals)
}

async function fetchThorPools(cache: Cache): Promise<ThorPool[]> {
    return cache.get(
        ['thorchain', 'pools'],
        async () => {
            const url = new URL(`${thorApiUrl}/pools`)
            const response = await fetch(url.toString(), {
                headers: {
                    'x-client-id': 'symbiosis',
                },
            })
            const data = await response.json()
            return data as ThorPool[]
        },
        600 // 10 minutes
    )
}

export async function checkThorPool(cache: Cache, token: Token): Promise<ThorPool> {
    const pools = await fetchThorPools(cache)

    const found = pools.find((i) => i.asset === toThorToken(token))
    if (!found) {
        throw new ThorChainError('Thor pool not found')
    }
    if (found.status !== 'Available') {
        throw new ThorChainError('Thor pool is not available')
    }
    return found
}

type ThorInboundAddress = {
    chain: string
    address: string
}

async function fetchThorInboundAddresses(cache: Cache): Promise<ThorInboundAddress[]> {
    return cache.get(
        ['thorchain', 'inbound_addresses'],
        async () => {
            const url = new URL(`${thorApiUrl}/inbound_addresses`)
            const response = await fetch(url.toString(), {
                headers: {
                    'x-client-id': 'symbiosis',
                },
            })

            const json = await response.json()

            if (json.error) {
                throw new ThorChainError(json.error)
            }

            return json as ThorInboundAddress[]
        },
        600 // 10 minutes
    )
}

export async function getThorVault(cache: Cache, token: Token): Promise<string> {
    const addresses = await fetchThorInboundAddresses(cache)

    const found = addresses.find((i) => i.chain === toThorChain(token.chainId))
    if (!found) {
        throw new ThorChainError('Thor vault not found')
    }
    if (isTronChainId(token.chainId)) {
        return tronAddressToEvm(found.address as TronAddress)
    }
    return found.address
}

export async function getThorQuote(params: {
    thorTokenIn: Token
    thorTokenOut: string
    evmTo: Address
    bitcoinAddress: string
    amount: TokenAmount
}): Promise<ThorQuote> {
    const { thorTokenIn, thorTokenOut, evmTo, bitcoinAddress, amount } = params

    const url = new URL(`${thorApiUrl}/quote/swap`)

    url.searchParams.set('from_asset', toThorToken(thorTokenIn))
    url.searchParams.set('to_asset', thorTokenOut)
    url.searchParams.set('refund_address', evmTo)
    url.searchParams.set('amount', toThorAmount(amount).toString())
    url.searchParams.set('destination', bitcoinAddress)
    url.searchParams.set('streaming_interval', '1')
    url.searchParams.set('streaming_quantity', '0')
    url.searchParams.set('affiliate', 'symbiosis')
    url.searchParams.set('affiliate_bps', '20')

    const response = await fetch(url.toString(), {
        headers: {
            'x-client-id': 'symbiosis',
        },
    })

    const json = await response.json()

    if (json.error) {
        throw new ThorChainError(json.error)
    }
    const { memo, expected_amount_out: amountOut, router, expiry, fees } = json

    const defaultSlippage = 100 // 1%
    const amountOutMin = getMinAmount(defaultSlippage, amountOut)
    const patchedMemo = memo.replace('0/1/0', `${amountOutMin.toString()}/1/0`)

    return {
        memo: patchedMemo,
        amountOut: new TokenAmount(BTC, amountOut),
        amountOutMin: new TokenAmount(BTC, amountOutMin),
        router,
        expiry,
        fees,
    }
}

export function validateBitcoinAddress(address: string): void {
    const isAddressValid = validate(address)
    if (!isAddressValid) {
        throw new ThorChainError('Bitcoin address is not valid')
    }
    const addressInfo = getAddressInfo(address)
    if (addressInfo.type === AddressType.p2tr) {
        throw new ThorChainError(`ThorChain doesn't support taproot addresses`)
    }
}

export const ETH_USDC = new Token({
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    chainId: ChainId.ETH_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const AVAX_USDC = new Token({
    address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    chainId: ChainId.AVAX_MAINNET,
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

export const BSC_USDC = new Token({
    name: 'USD Coin',
    address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    symbol: 'USDC',
    decimals: 18,
    chainId: ChainId.BSC_MAINNET,
    icons: {
        large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
        small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png',
    },
})

// export const TRON_USDT = new Token({
//     name: 'Tether USDt',
//     symbol: 'USDT',
//     address: '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c',
//     chainId: ChainId.TRON_MAINNET,
//     decimals: 6,
//     icons: {
//         large: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
//         small: 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png',
//     },
// })

export const THOR_TOKENS_IN = [
    ETH_USDC,
    AVAX_USDC,
    BSC_USDC,
    // TRON_USDT
]

import { AddressType, getAddressInfo, validate } from 'bitcoin-address-validation'
import { BigNumber } from 'ethers'

import { ChainId } from '../../../constants'
import type { TokenAmount } from '../../../entities'
import { GAS_TOKEN, Token } from '../../../entities'
import { isTronChainId, tronAddressToEvm } from '../../chainUtils'
import type { Cache } from '../../cache'
import { ThorChainError } from '../../sdkError'
import type { Address, EvmAddress, TronAddress } from '../../types'
import TronWeb from 'tronweb'
import type { BaseQuoteResponse, QuoteFees, QuoteSwapResponse } from '../../api/thorchain'
import { thorchainApi } from '../../api/thorchain'

export type ThorQuoteSwapResponse = BaseQuoteResponse &
    QuoteSwapResponse & {
        fees: QuoteFees
        router: string
        memo: string
        amount_out_min: string
    }

export const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]

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

function toThorToken(token: Token): string {
    const chain = toThorChain(token.chainId)
    let tokenAddress: EvmAddress | TronAddress = token.address as EvmAddress
    if (isTronChainId(token.chainId)) {
        tokenAddress = TronWeb.address.fromHex(tokenAddress) as TronAddress
    }
    return `${chain}.${token.symbol}-${tokenAddress.toUpperCase()}`
}

// the source asset amount in 1e8 decimals
function toThorAmount(tokenAmount: TokenAmount): BigNumber {
    const tokenDecimals = BigNumber.from(10).pow(tokenAmount.token.decimals)
    const thorDecimals = BigNumber.from(10).pow(8)
    return BigNumber.from(tokenAmount.raw.toString()).mul(thorDecimals).div(tokenDecimals)
}

export async function getThorVault(cache: Cache, token: Token): Promise<string> {
    const pools = await cache.get(['thorchain', 'pools'], () => thorchainApi.thorchain.pools(), 600)

    const thorToken = toThorToken(token)
    const pool = pools.find((i) => i.asset === thorToken)
    if (!pool) {
        throw new ThorChainError(`Thor pool not found for ${thorToken}`)
    }
    if (pool.status !== 'Available') {
        throw new ThorChainError(`Thor pool ${thorToken} is not available (status: ${pool.status})`)
    }

    const addresses = await cache.get(
        ['thorchain', 'inbound_addresses'],
        () => thorchainApi.thorchain.inboundAddresses(),
        600
    )

    const chain = toThorChain(token.chainId)
    const found = addresses.find((i) => i.chain === chain)
    if (!found || !found.address) {
        throw new ThorChainError(`Thor vault not found for chain ${chain}`)
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
    slippage: number
}): Promise<ThorQuoteSwapResponse> {
    const { thorTokenIn, thorTokenOut, evmTo, bitcoinAddress, amount, slippage } = params

    let response
    try {
        response = (await thorchainApi.thorchain.quoteswap({
            from_asset: toThorToken(thorTokenIn),
            to_asset: thorTokenOut,
            refund_address: evmTo,
            amount: toThorAmount(amount).toNumber(),
            destination: bitcoinAddress,
            streaming_interval: 1,
            streaming_quantity: 0,
            affiliate: 'symbiosis',
            affiliate_bps: 20,
            liquidity_tolerance_bps: slippage,
        })) as ThorQuoteSwapResponse
    } catch (error) {
        throw new ThorChainError('THORChain /quote/swap: call error', error)
    }

    const { memo, router, fees } = response

    if (!memo) {
        throw new ThorChainError('THORChain /quote/swap: missing memo in response')
    }
    if (!router) {
        throw new ThorChainError('THORChain /quote/swap: missing router in response')
    }
    if (!fees) {
        throw new ThorChainError('THORChain /quote/swap: missing fees in response')
    }

    const limitMatch = memo.match(/(\d+)\/1\/0/)
    if (!limitMatch) {
        throw new ThorChainError(`THORChain /quote/swap: failed to parse limit from memo: ${memo}`)
    }

    return {
        ...response,
        amount_out_min: limitMatch[1],
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

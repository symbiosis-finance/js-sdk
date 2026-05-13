import { BigNumber } from 'ethers'

import { ChainId } from '../../../constants'
import type { TokenAmount } from '../../../entities'
import { Token } from '../../../entities'
import { isTronChainId, tronAddressToEvm } from '../../chainUtils'
import type { Cache } from '../../cache'
import { ThorChainError } from '../../sdkError'
import type { Address, EvmAddress, TronAddress } from '../../types'
import TronWeb from 'tronweb'
import type { BaseQuoteResponse, Pool, QuoteFees, QuoteSwapResponse } from '../../api/thorchain'
import { thorchainApi } from '../../api/thorchain'

export type ThorQuoteSwapResponse = BaseQuoteResponse &
    QuoteSwapResponse & {
        fees: QuoteFees
        router: string
        memo: string
        amount_out_min: string
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

function toThorToken(token: Token): string {
    const chain = toThorChain(token.chainId)
    let tokenAddress: EvmAddress | TronAddress = token.address as EvmAddress
    if (isTronChainId(token.chainId)) {
        tokenAddress = TronWeb.address.fromHex(tokenAddress) as TronAddress
    }
    return `${chain}.${token.symbol}-${tokenAddress.toUpperCase()}`
}

// the source asset amount in 1e8 decimals
export function toThorAmount(tokenAmount: TokenAmount): BigNumber {
    const tokenDecimals = BigNumber.from(10).pow(tokenAmount.token.decimals)
    const thorDecimals = BigNumber.from(10).pow(8)
    return BigNumber.from(tokenAmount.raw.toString()).mul(thorDecimals).div(tokenDecimals)
}

// Convert a 1e8 THORChain amount string to the destination token's decimal raw representation.
export function fromThorAmount(thorRaw: string, dstDecimals: number): string {
    const THOR_DECIMALS = 8
    if (dstDecimals === THOR_DECIMALS) return thorRaw
    if (dstDecimals > THOR_DECIMALS) {
        return BigNumber.from(thorRaw)
            .mul(BigNumber.from(10).pow(dstDecimals - THOR_DECIMALS))
            .toString()
    }
    return BigNumber.from(thorRaw)
        .div(BigNumber.from(10).pow(THOR_DECIMALS - dstDecimals))
        .toString()
}

// Returns a tradable pool. Both `status === 'Available'` AND `!trading_halted` required (DOGE-style halts pass `status` alone).
export async function getThorPool(cache: Cache, asset: string): Promise<Pool> {
    const pools = await cache.get(
        ['thorchain', 'pools'],
        () => thorchainApi.thorchain.pools(),
        600 // 10 minutes
    )
    const pool = pools.find((i) => i.asset === asset)
    if (!pool) {
        throw new ThorChainError(`Thor pool not found for ${asset}`)
    }
    if (pool.status !== 'Available') {
        throw new ThorChainError(`Thor pool ${asset} is not available (status: ${pool.status})`)
    }
    if (pool.trading_halted) {
        throw new ThorChainError(`Thor pool ${asset} has trading halted`)
    }
    return pool
}

export async function getThorVault(cache: Cache, token: Token): Promise<string> {
    const thorToken = toThorToken(token)
    await getThorPool(cache, thorToken)

    const addresses = await cache.get(
        ['thorchain', 'inbound_addresses'],
        () => thorchainApi.thorchain.inboundAddresses(),
        600 // 10 minutes
    )

    const chain = toThorChain(token.chainId)
    const found = addresses.find((i) => i.chain === chain)
    if (!found) {
        throw new ThorChainError(`Thor vault not found for chain ${chain}`)
    }
    if (!found.address) {
        throw new ThorChainError(`Thor vault address not found for chain ${chain}`)
    }
    if (found.halted) {
        throw new ThorChainError(`Thor vault is halted for chain ${chain}`)
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

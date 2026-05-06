import { AddressZero } from '@ethersproject/constants'

import { ChainId } from '../../../constants'
import { Percent, TokenAmount } from '../../../entities'
import { BIPS_BASE } from '../../constants'
import { ThorChainError } from '../../sdkError'
import { SymbiosisTradeType } from '../../trade'
import type { SwapExactInParams, SwapExactInResult } from '../../types'

import type { BaseQuoteResponse, QuoteFees, QuoteSwapResponse } from '../../api/thorchain'
import { thorchainApi } from '../../api/thorchain'
import { getThorChainDestination, isThorChainNativeSourceChainId, THORCHAIN_CHAIN_MAP } from './constants'
import { validateThorDestinationAddress } from './thorChainAddressValidation'
import { fromThorAmount, toThorAmount } from './utils'

// Source chains with 80-byte OP_RETURN memo limit. For these we apply THORChain's full
// memo-reduction toolkit per https://dev.thorchain.org/concepts/memo-length-reduction.html:
//   1. Asset abbreviation: `AVAX.USDC` instead of `AVAX.USDC-0X…address` (-41 bytes).
//   2. Drop affiliate ('symbiosis' + bps adds ~12 bytes; we have no short THORName registered).
//   3. Drop streaming params (`/INTERVAL/QUANTITY` is omitted from memo).
//   4. Drop refund_address: for UTXO sources (BCH/LTC/DOGE) THORChain auto-refunds to the
//      input tx's source address; passing it forces THORChain to embed the 42-char cashaddr
//      in the memo, which blows the 80-byte budget.
//   5. THORChain handles function abbreviation (`=`) and scientific-notation LIM internally.
// XRP source has a 1KB Memo field — no constraint — so all fields stay on.
const TIGHT_MEMO_SOURCE_CHAINS = new Set<ChainId>([
    ChainId.BCH_MAINNET,
    ChainId.LTC_MAINNET,
    ChainId.DOGE_MAINNET,
])

type ThorDepositQuoteResponse = BaseQuoteResponse &
    QuoteSwapResponse & {
        fees: QuoteFees
        memo: string
    }

const ZERO_PRICE_IMPACT = new Percent('0', BIPS_BASE)

// Drop the `-0X…address` suffix from a `CHAIN.SYMBOL-ADDRESS` Thor asset string.
// THORChain resolves `CHAIN.SYMBOL` via deepest-pool match; safe because every symbol in
// THORCHAIN_DESTINATIONS is unique within its chain.
function abbreviateThorAsset(thorAsset: string): string {
    return thorAsset.split('-')[0]
}

export async function thorChainDepositSwap(params: SwapExactInParams): Promise<SwapExactInResult> {
    const { tokenAmountIn, tokenOut, to, slippage } = params
    const fromChainId = tokenAmountIn.token.chainId

    if (!isThorChainNativeSourceChainId(fromChainId)) {
        throw new ThorChainError(`Unsupported THORChain source chain: ${fromChainId}`)
    }
    const fromChainPrefix = THORCHAIN_CHAIN_MAP[fromChainId]!.prefix

    const destination = getThorChainDestination(tokenOut)
    validateThorDestinationAddress(destination.token.chainId, to)

    const fromAsset = `${fromChainPrefix}.${fromChainPrefix}` // L1 native: e.g. "LTC.LTC"

    // Always send the abbreviated form; THORChain resolves it to the same pool either way and
    // the memo it generates is shorter — useful for both BCH/LTC/DOGE (OP_RETURN) and XRP.
    const toAsset = abbreviateThorAsset(destination.thorAsset)

    const tightMemo = TIGHT_MEMO_SOURCE_CHAINS.has(fromChainId)

    let response
    try {
        response = (await thorchainApi.thorchain.quoteswap({
            from_asset: fromAsset,
            to_asset: toAsset,
            amount: toThorAmount(tokenAmountIn).toNumber(),
            destination: to,
            ...(tightMemo ? {} : { refund_address: params.from }),
            ...(tightMemo ? {} : { streaming_interval: 1, streaming_quantity: 0 }),
            ...(tightMemo ? {} : { affiliate: 'symbiosis', affiliate_bps: 20 }),
            liquidity_tolerance_bps: slippage,
        })) as ThorDepositQuoteResponse
    } catch (error) {
        throw new ThorChainError(
            `THORChain /quote/swap (deposit): call error [SENT from_asset=${fromAsset} to_asset=${toAsset} tightMemo=${tightMemo}]`,
            error
        )
    }

    const {
        inbound_address,
        memo,
        expected_amount_out,
        fees,
        expiry,
        router,
        dust_threshold,
        recommended_min_amount_in,
    } = response

    if (!inbound_address) throw new ThorChainError('THORChain quote: missing inbound_address')
    if (!memo) throw new ThorChainError('THORChain quote: missing memo')
    if (!fees) throw new ThorChainError('THORChain quote: missing fees')

    const expectedOutRaw = fromThorAmount(expected_amount_out, tokenOut.decimals)
    const feesValueRaw = fromThorAmount(fees.total, tokenOut.decimals)

    const tokenAmountOut = new TokenAmount(tokenOut, expectedOutRaw)

    return {
        kind: 'thorchain-deposit',
        transactionType: 'thorchain',
        transactionRequest: {
            inboundAddress: inbound_address,
            memo,
            expectedAmountOut: expectedOutRaw,
            expiry: expiry,
            router: router || undefined,
            dustThreshold: dust_threshold,
            recommendedMinAmountIn: recommended_min_amount_in,
        },
        tokenAmountOut,
        tokenAmountOutMin: tokenAmountOut, // server enforces tolerance via memo limit
        priceImpact: ZERO_PRICE_IMPACT,
        approveTo: AddressZero,
        labels: ['partner-swap'],
        routes: [
            {
                provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
                tokens: [tokenAmountIn.token, tokenOut],
            },
        ],
        fees: [
            {
                provider: SymbiosisTradeType.THORCHAIN_BRIDGE,
                description: 'THORChain fee',
                value: new TokenAmount(tokenOut, feesValueRaw),
            },
        ],
    }
}

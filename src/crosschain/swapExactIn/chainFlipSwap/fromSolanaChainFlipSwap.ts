import type { Quote, VaultSwapResponse } from '@chainflip/sdk/swap'
import { SwapSDK } from '@chainflip/sdk/swap'
import type { AddressLookupTableAccount, Connection } from '@solana/web3.js'
import { PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js'

import JSBI from 'jsbi'
import TronWeb from 'tronweb'

import { ChainId } from '../../../constants'
import type { Token } from '../../../entities'
import { GAS_TOKEN, Percent, TokenAmount } from '../../../entities'
import { getMinAmount, isTronChainId } from '../../chainUtils'
import { BIPS_BASE } from '../../constants'
import { getTokenPriceUsd } from '../../coingecko/getTokenPriceUsd'
import { ChainFlipError } from '../../sdkError'
import { JupiterTrade, TradeProvider } from '../../trade'
import { withPromisesSpan, withSpan } from '../../tracing'
import type { SwapExactInParams, SwapExactInResult } from '../../types'
import type { ChainFlipConfig, ChainFlipToken } from './types'
import {
    ARB_USDC,
    CF_ARB_ETH,
    CF_ARB_USDC,
    CF_BTC_BTC,
    CF_ETH_ETH,
    CF_ETH_USDC,
    CF_SOL_SOL,
    CF_SOL_USDC,
    CF_TRON_TRX,
    CF_TRON_USDT,
    ChainFlipBrokerAccount,
    ChainFlipBrokerFeeBps,
    checkMinAmount,
    TRON_USDT,
} from './utils'

const CONFIGS: ChainFlipConfig[] = [
    // SOL → BTC
    {
        src: CF_SOL_SOL,
        dst: CF_BTC_BTC,
    },
    // SOL → ETH
    {
        src: CF_SOL_SOL,
        dst: CF_ETH_ETH,
    },
    // SOL → ETH USDC
    {
        src: CF_SOL_SOL,
        dst: CF_ETH_USDC,
    },
    // SOL → ARB ETH
    {
        src: CF_SOL_SOL,
        dst: CF_ARB_ETH,
    },
    // SOL → ARB USDC
    {
        src: CF_SOL_SOL,
        dst: CF_ARB_USDC,
    },
    // SOL USDC → BTC
    {
        src: CF_SOL_USDC,
        dst: CF_BTC_BTC,
    },
    // SOL USDC → ETH
    {
        src: CF_SOL_USDC,
        dst: CF_ETH_ETH,
    },
    // SOL USDC → ETH USDC
    {
        src: CF_SOL_USDC,
        dst: CF_ETH_USDC,
    },
    // SOL USDC → ARB ETH
    {
        src: CF_SOL_USDC,
        dst: CF_ARB_ETH,
    },
    // SOL USDC → ARB USDC
    {
        src: CF_SOL_USDC,
        dst: CF_ARB_USDC,
    },
    // SOL USDC → TRON USDT
    {
        src: CF_SOL_USDC,
        dst: CF_TRON_USDT,
    },
    // SOL → TRON USDT
    {
        src: CF_SOL_SOL,
        dst: CF_TRON_USDT,
    },
    // SOL USDC → TRON TRX
    {
        src: CF_SOL_USDC,
        dst: CF_TRON_TRX,
    },
    // SOL → TRON TRX
    {
        src: CF_SOL_SOL,
        dst: CF_TRON_TRX,
    },
]

export const CHAIN_FLIP_FROM_SOLANA_TOKENS_OUT = CONFIGS.map((c) => c.dst.token)

export function fromSolanaChainFlipSwap(context: SwapExactInParams): Promise<SwapExactInResult>[] {
    return withPromisesSpan('fromSolanaChainFlipSwap', {}, () => {
        const { tokenAmountIn, tokenOut } = context

        const CF_CONFIGS = CONFIGS.filter((config) => config.dst.token.equals(tokenOut))
        if (!CF_CONFIGS.length) {
            return []
        }

        const promises: Promise<SwapExactInResult>[] = []

        const jupiterDisabled = context.disabledProviders?.includes(TradeProvider.JUPITER)

        for (const config of CF_CONFIGS) {
            if (tokenAmountIn.token.equals(config.src.token)) {
                // Exact tokenIn match — direct vault swap
                promises.push(directSolanaVaultSwap(context, config))
                break
            } else if (!jupiterDisabled) {
                // Different Solana token — pre-swap via Jupiter then vault swap
                promises.push(indirectSolanaVaultSwap(context, config))
            }
        }

        return promises
    })
}

// ─── ChainFlip quote / encode (traced, shared by direct & indirect) ─────────────

async function getRegularQuote(
    chainFlipSdk: SwapSDK,
    amount: string,
    src: ChainFlipToken,
    dst: ChainFlipToken
): Promise<Quote> {
    let quote
    try {
        const { quotes } = await withSpan(
            'chainFlip.getQuoteV2',
            { amount, srcAsset: src.asset, destAsset: dst.asset, destChain: dst.chain },
            () =>
                chainFlipSdk.getQuoteV2({
                    amount,
                    srcChain: src.chain,
                    srcAsset: src.asset,
                    destChain: dst.chain,
                    destAsset: dst.asset,
                    isVaultSwap: true,
                    brokerCommissionBps: ChainFlipBrokerFeeBps,
                })
        )
        quote = quotes.find((q) => q.type === 'REGULAR')
    } catch (e) {
        throw new ChainFlipError('getQuoteV2 error', e)
    }
    if (!quote) {
        throw new ChainFlipError('There is no REGULAR quote found')
    }
    return quote
}

async function encodeVaultSwap(
    chainFlipSdk: SwapSDK,
    quote: Quote,
    from: string,
    to: string,
    dst: ChainFlipToken
): Promise<Extract<VaultSwapResponse, { chain: 'Solana' }>> {
    let vaultSwapData: VaultSwapResponse
    try {
        vaultSwapData = await withSpan('chainFlip.encodeVaultSwapData', { destChain: dst.chain }, () =>
            chainFlipSdk.encodeVaultSwapData({
                quote,
                srcAddress: from,
                // ChainFlip expects a base58 Tron address, but swapExactIn converts a Tron `to` to EVM hex upstream
                destAddress: isTronChainId(dst.token.chainId) ? TronWeb.address.fromHex(to) : to,
                fillOrKillParams: {
                    slippageTolerancePercent: quote.recommendedSlippageTolerancePercent,
                    refundAddress: from,
                    retryDurationBlocks: 100,
                },
                brokerAccount: ChainFlipBrokerAccount,
                brokerCommissionBps: ChainFlipBrokerFeeBps,
            })
        )
    } catch (e) {
        throw new ChainFlipError('encodeVaultSwapData error', e)
    }
    if (vaultSwapData.chain !== 'Solana') {
        throw new ChainFlipError(`Unexpected vault swap chain: ${vaultSwapData.chain}`)
    }
    return vaultSwapData
}

// ─── Direct vault swap (tokenIn is already SOL or SOL_USDC) ─────────────────

function directSolanaVaultSwap(params: SwapExactInParams, config: ChainFlipConfig): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, symbiosis } = params
    const { src, dst } = config

    return withSpan(
        'directSolanaVaultSwap',
        {
            route: `${src.chain}.${src.asset} -> ${dst.chain}.${dst.asset}`,
            srcChain: src.chain,
            srcAsset: src.asset,
            destChain: dst.chain,
            destAsset: dst.asset,
            tokenIn: tokenAmountIn.token.symbol ?? '',
            amountIn: tokenAmountIn.raw.toString(),
        },
        async () => {
            const chainFlipSdk = new SwapSDK({ network: 'mainnet' })

            await checkMinAmount(symbiosis.cache, chainFlipSdk, tokenAmountIn)

            const quote = await getRegularQuote(chainFlipSdk, tokenAmountIn.raw.toString(), src, dst)

            const vaultSwapData = await encodeVaultSwap(chainFlipSdk, quote, from, to, dst)

            const connection = symbiosis.solanaConnection()
            const instructions = await withSpan('buildSolanaVaultTransaction', {}, () =>
                buildSolanaVaultTransaction(from, vaultSwapData, connection)
            )

            const { egressAmount, recommendedSlippageTolerancePercent } = quote
            const egressAmountMin = getMinAmount(recommendedSlippageTolerancePercent * 100, egressAmount)
            const {
                usdcFeeToken,
                solFeeToken,
                btcFeeToken,
                ethFeeToken,
                arbEthFeeToken,
                trxFeeToken,
                tronUsdtFeeToken,
            } = getChainFlipFeeExtended(quote)
            const priceImpact = await calcPriceImpact(tokenAmountIn.token, dst.token, quote.depositAmount, egressAmount)

            return {
                operationType: 'crosschain-swap',
                tokenAmountOut: new TokenAmount(dst.token, egressAmount),
                tokenAmountOutMin: new TokenAmount(dst.token, egressAmountMin),
                priceImpact,
                approveTo: '0x0000000000000000000000000000000000000000',
                amountInUsd: tokenAmountIn,
                transactionType: 'solana',
                transactionRequest: { instructions },
                fees: [
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: usdcFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: solFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: btcFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: ethFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: arbEthFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: trxFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: tronUsdtFeeToken },
                ],
                labels: ['partner-swap'],
                routes: [{ provider: TradeProvider.CHAINFLIP_BRIDGE, tokens: [tokenAmountIn.token, dst.token] }],
            }
        },
        (res) => ({
            tokenAmountOut: res.tokenAmountOut.toString(),
            tokenAmountOutMin: res.tokenAmountOutMin.toString(),
        })
    )
}

// ─── Indirect vault swap (swap tokenIn → config.tokenIn first, then vault) ───

function indirectSolanaVaultSwap(params: SwapExactInParams, config: ChainFlipConfig): Promise<SwapExactInResult> {
    const { tokenAmountIn, from, to, slippage, symbiosis } = params
    const { src, dst } = config

    return withSpan(
        'indirectSolanaVaultSwap',
        {
            route: `${tokenAmountIn.token.symbol} -> ${src.chain}.${src.asset} -> ${dst.chain}.${dst.asset}`,
            srcChain: src.chain,
            srcAsset: src.asset,
            destChain: dst.chain,
            destAsset: dst.asset,
            tokenIn: tokenAmountIn.token.symbol ?? '',
            amountIn: tokenAmountIn.raw.toString(),
        },
        async () => {
            // Step 1: Jupiter swap tokenIn → config.tokenIn
            const jupiterTrade = new JupiterTrade({
                symbiosis,
                tokenAmountIn,
                tokenAmountInMin: tokenAmountIn,
                tokenOut: src.token,
                to: from,
                slippage,
            })

            await withSpan(
                'jupiterTrade.init',
                { tokenIn: tokenAmountIn.token.symbol ?? '', tokenOut: src.token.symbol ?? '' },
                () => jupiterTrade.init()
            ).catch((e) => {
                symbiosis.countAggregatorError({
                    provider: TradeProvider.JUPITER,
                    reason: e.message,
                    chain_id: String(src.token.chain?.id),
                })
                throw e
            })

            const swapAmountIn = jupiterTrade.amountOutMin

            // Step 2: ChainFlip vault swap for the minimum swap output
            const chainFlipSdk = new SwapSDK({ network: 'mainnet' })

            await checkMinAmount(symbiosis.cache, chainFlipSdk, swapAmountIn)

            const quote = await getRegularQuote(chainFlipSdk, swapAmountIn.raw.toString(), src, dst)

            const vaultSwapData = await encodeVaultSwap(chainFlipSdk, quote, from, to, dst)

            // Step 3: Combine Jupiter transaction with ChainFlip instruction
            const jupiterTxBase64 = jupiterTrade.instructions
            if (!jupiterTxBase64) {
                throw new ChainFlipError('Jupiter trade has no instructions')
            }

            const chainFlipInstruction = buildTransactionInstruction(vaultSwapData)
            const connection = symbiosis.solanaConnection()
            const instructions = await withSpan('appendInstructionToTransaction', {}, () =>
                appendInstructionToTransaction(jupiterTxBase64, chainFlipInstruction, connection)
            )

            const { egressAmount, recommendedSlippageTolerancePercent } = quote
            const egressAmountMin = getMinAmount(recommendedSlippageTolerancePercent * 100, egressAmount)
            const {
                usdcFeeToken,
                solFeeToken,
                btcFeeToken,
                ethFeeToken,
                arbEthFeeToken,
                trxFeeToken,
                tronUsdtFeeToken,
            } = getChainFlipFeeExtended(quote)

            // Total price impact = Jupiter pre-swap impact + ChainFlip bridge impact
            const cfPriceImpact = await calcPriceImpact(src.token, dst.token, quote.depositAmount, egressAmount)
            const priceImpact = jupiterTrade.priceImpact.add(cfPriceImpact)

            return {
                operationType: 'crosschain-swap',
                tokenAmountOut: new TokenAmount(dst.token, egressAmount),
                tokenAmountOutMin: new TokenAmount(dst.token, egressAmountMin),
                priceImpact,
                approveTo: '0x0000000000000000000000000000000000000000',
                amountInUsd: swapAmountIn,
                transactionType: 'solana',
                transactionRequest: { instructions },
                fees: [
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: usdcFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: solFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: btcFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: ethFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: arbEthFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: trxFeeToken },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, description: 'ChainFlip fee', value: tronUsdtFeeToken },
                ],
                labels: ['partner-swap'],
                routes: [
                    { provider: TradeProvider.JUPITER, tokens: [tokenAmountIn.token, src.token] },
                    { provider: TradeProvider.CHAINFLIP_BRIDGE, tokens: [src.token, dst.token] },
                ],
            }
        },
        (res) => ({
            tokenAmountOut: res.tokenAmountOut.toString(),
            tokenAmountOutMin: res.tokenAmountOutMin.toString(),
        })
    )
}

// ─── Solana transaction helpers ───────────────────────────────────────────────

function buildTransactionInstruction(
    vaultSwapData: Extract<VaultSwapResponse, { chain: 'Solana' }>
): TransactionInstruction {
    return new TransactionInstruction({
        programId: new PublicKey(vaultSwapData.programId),
        keys: vaultSwapData.accounts.map(({ pubkey, isSigner, isWritable }) => ({
            pubkey: new PublicKey(pubkey),
            isSigner,
            isWritable,
        })),
        data: Buffer.from(vaultSwapData.data.replace(/^0x/, ''), 'hex'),
    })
}

async function buildSolanaVaultTransaction(
    payer: string,
    vaultSwapData: Extract<VaultSwapResponse, { chain: 'Solana' }>,
    connection: Connection
): Promise<string> {
    const instruction = buildTransactionInstruction(vaultSwapData)
    const { blockhash } = await connection.getLatestBlockhash()
    const message = new TransactionMessage({
        payerKey: new PublicKey(payer),
        recentBlockhash: blockhash,
        instructions: [instruction],
    }).compileToV0Message()

    const transaction = new VersionedTransaction(message)
    return Buffer.from(transaction.serialize()).toString('base64')
}

async function appendInstructionToTransaction(
    base64Tx: string,
    instruction: TransactionInstruction,
    connection: Connection
): Promise<string> {
    const txBuffer = Buffer.from(base64Tx, 'base64')
    const transaction = VersionedTransaction.deserialize(txBuffer)

    const lookupTableAccounts = await Promise.all(
        transaction.message.addressTableLookups.map(async (lookup) => {
            const response = await connection.getAddressLookupTable(lookup.accountKey)
            return response.value as AddressLookupTableAccount
        })
    )

    const message = TransactionMessage.decompile(transaction.message, {
        addressLookupTableAccounts: lookupTableAccounts,
    })

    message.instructions.push(instruction)

    transaction.message = message.compileToV0Message(lookupTableAccounts)
    return Buffer.from(transaction.serialize()).toString('base64')
}

// ─── Price impact ─────────────────────────────────────────────────────────────

async function calcPriceImpact(
    tokenIn: Token,
    tokenOut: Token,
    depositAmount: string,
    egressAmount: string
): Promise<Percent> {
    try {
        const [priceIn, priceOut] = await Promise.all([getTokenPriceUsd(tokenIn), getTokenPriceUsd(tokenOut)])
        if (!priceIn || !priceOut) {
            return new Percent(JSBI.BigInt(0), BIPS_BASE)
        }

        const depositHuman = Number(depositAmount) / 10 ** tokenIn.decimals
        const egressHuman = Number(egressAmount) / 10 ** tokenOut.decimals

        const inputUsd = depositHuman * priceIn
        const outputUsd = egressHuman * priceOut

        // Negative means user receives less value than they put in
        const impactBips = Math.round(((outputUsd - inputUsd) / inputUsd) * 10000)
        return new Percent(JSBI.BigInt(impactBips), BIPS_BASE)
    } catch {
        return new Percent(JSBI.BigInt(0), BIPS_BASE)
    }
}

// ─── Fee helpers ──────────────────────────────────────────────────────────────

function getChainFlipFeeExtended(quote: Quote) {
    const ETH = GAS_TOKEN[ChainId.ETH_MAINNET]
    const ARB_ETH = GAS_TOKEN[ChainId.ARBITRUM_MAINNET]
    const SOL = GAS_TOKEN[ChainId.SOLANA_MAINNET]
    const BTC = GAS_TOKEN[ChainId.BTC_MAINNET]
    const TRX = GAS_TOKEN[ChainId.TRON_MAINNET]

    let usdcFee = 0
    let solFee = 0
    let btcFee = 0
    let ethFee = 0
    let arbEthFee = 0
    let trxFee = 0
    let tronUsdtFee = 0

    quote.includedFees.forEach(({ chain, asset, amount }) => {
        if (asset === 'USDC') {
            usdcFee += parseInt(amount)
        } else if (asset === 'SOL') {
            solFee += parseInt(amount)
        } else if (asset === 'BTC') {
            btcFee += parseInt(amount)
        } else if (asset === 'ETH' && chain === 'Ethereum') {
            ethFee += parseInt(amount)
        } else if (asset === 'ETH' && chain === 'Arbitrum') {
            arbEthFee += parseInt(amount)
        } else if (asset === 'TRX') {
            trxFee += parseInt(amount)
        } else if (asset === 'USDT' && chain === 'Tron') {
            tronUsdtFee += parseInt(amount)
        }
    })

    return {
        usdcFeeToken: new TokenAmount(ARB_USDC, usdcFee.toString()), // FIXME ARB_USDC is not correct
        solFeeToken: new TokenAmount(SOL, solFee.toString()),
        btcFeeToken: new TokenAmount(BTC, btcFee.toString()),
        ethFeeToken: new TokenAmount(ETH, ethFee.toString()),
        arbEthFeeToken: new TokenAmount(ARB_ETH, arbEthFee.toString()),
        trxFeeToken: new TokenAmount(TRX, trxFee.toString()),
        tronUsdtFeeToken: new TokenAmount(TRON_USDT, tronUsdtFee.toString()),
    }
}

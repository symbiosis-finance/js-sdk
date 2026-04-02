import { Interface } from '@ethersproject/abi'
import { parseUnits } from '@ethersproject/units'
import {
    createAssociatedTokenAccountIdempotentInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { Address, beginCell } from '@ton/core'
import { JettonMaster } from '@ton/ton'
import TronWeb from 'tronweb'

import { GAS_TOKEN, Token, TokenAmount } from '../../../entities'
import { isEvmChainId, isTonChainId, isTronChainId } from '../../chainUtils'
import { isSolanaChainId, getSolanaConnection } from '../../chainUtils/solana'
import { AmountTooHighError, AmountTooLowError, ChangellyError } from '../../sdkError'
import type { Symbiosis } from '../../symbiosis'
import type { ChangellyTransactionData, FeeItem, TonTransactionData } from '../../types'
import { SymbiosisTradeType } from '../../trade/symbiosisTrade'
import {
    CHANGELLY_NATIVE_CHAINS,
    CHANGELLY_NATIVE_DECIMALS,
    DEPOSIT_VALIDITY_MS,
    TON_TX_VALIDITY_SECONDS,
    TRON_TRANSFER_FEE_LIMIT,
} from './constants'
import { resolveChangellyTicker } from './changellyUtils'
import type { PairsParamsResponse } from './types'

// --- Estimate ---

export interface ChangellyEstimateResult {
    rateId: string
    amountTo: string
    tokenAmountOut: TokenAmount
    tokenInResolved: Token
    tokenOutResolved: Token
    fees: FeeItem[]
    currencyFrom: string
    currencyTo: string
    amountFrom: string
}

export async function getChangellyEstimate(
    symbiosis: Symbiosis,
    tokenAmountIn: TokenAmount,
    tokenOut: Token
): Promise<ChangellyEstimateResult> {
    const currencyFrom = await resolveChangellyTicker(symbiosis, tokenAmountIn.token)
    const currencyTo = await resolveChangellyTicker(symbiosis, tokenOut)
    const amountFrom = tokenAmountIn.toExact()

    const rate = await symbiosis.changelly.getFixRateForAmount(currencyFrom, currencyTo, amountFrom)

    if (!rate || !rate.id) {
        const tokenSymbol = tokenAmountIn.token.symbol || currencyFrom.toUpperCase()

        // Fallback: getPairsParams to get min/max limits
        const pairParams = await symbiosis.changelly.getPairsParams(currencyFrom, currencyTo)
        if (pairParams) {
            throwPairLimitError(pairParams, amountFrom, tokenSymbol)
        }

        throw new ChangellyError('This pair is not available')
    }

    const tokenInResolved = resolveInputToken(tokenAmountIn.token, currencyFrom)
    const tokenOutResolved = resolveOutputToken(tokenOut, currencyTo)
    const networkFee = rate.networkFee || '0'
    const decimals = tokenOutResolved.decimals

    // amountTo is before networkFee deduction per Changelly docs
    const grossRaw = parseUnits(rate.amountTo, decimals)
    const feeRaw = parseUnits(networkFee, decimals)
    const netAmountRaw = grossRaw.sub(feeRaw).lt(0) ? '0' : grossRaw.sub(feeRaw).toString()

    return {
        rateId: rate.id,
        amountTo: rate.amountTo,
        tokenAmountOut: new TokenAmount(tokenOutResolved, netAmountRaw),
        tokenInResolved,
        tokenOutResolved,
        fees: buildFees(networkFee, tokenOutResolved),
        currencyFrom,
        currencyTo,
        amountFrom,
    }
}

// --- Deposit creation ---

export interface CreateChangellyDepositParams {
    currencyFrom: string
    currencyTo: string
    amountFrom: string
    rateId: string
    address: string
    refundAddress: string
    extraIdTo?: string
}

export async function createChangellyDeposit(
    symbiosis: Symbiosis,
    params: CreateChangellyDepositParams
): Promise<ChangellyTransactionData> {
    const { currencyFrom, currencyTo, amountFrom, rateId, address, refundAddress, extraIdTo } = params

    const [isPayoutValid, isRefundValid] = await Promise.all([
        symbiosis.changelly.validateAddress(currencyTo, address),
        symbiosis.changelly.validateAddress(currencyFrom, refundAddress),
    ])
    if (!isPayoutValid) {
        throw new ChangellyError(`Invalid payout address "${address}" for ${currencyTo}`)
    }
    if (!isRefundValid) {
        throw new ChangellyError(`Invalid refund address "${refundAddress}" for ${currencyFrom}`)
    }

    const txResult = await symbiosis.changelly.createFixTransaction({
        from: currencyFrom,
        to: currencyTo,
        address,
        amountFrom,
        rateId,
        refundAddress,
        extraIdTo: extraIdTo || undefined,
    })

    if (!txResult || !txResult.id) {
        throw new ChangellyError('Failed to create fixed-rate transaction')
    }

    // amountExpectedTo is before networkFee according to Changelly docs — deduct for actual payout
    const networkFee = txResult.networkFee || '0'
    const expectedTo = Number(txResult.amountExpectedTo || '0')
    const netPayout = Math.max(expectedTo - Number(networkFee), 0).toString()

    return {
        changellyTxId: txResult.id,
        depositAddress: txResult.payinAddress,
        depositExtraId: txResult.payinExtraId || undefined,
        amountExpectedFrom: txResult.amountExpectedFrom,
        amountExpectedTo: netPayout,
        networkFee,
        validUntil: txResult.payTill ? new Date(txResult.payTill).getTime() : Date.now() + DEPOSIT_VALIDITY_MS,
        currencyFrom,
        currencyTo,
        refundAddress,
    }
}

// --- Trade tx building ---

export interface BuildChangellyTradeTxParams {
    currencyFrom: string
    currencyTo: string
    amountFrom: string
    rateId: string
    amountExpectedTo: string
    address: string
    refundAddress: string
    from: string
    tokenAmountIn: TokenAmount
    extraIdTo?: string
}

interface TronTxData {
    chain_id: number
    call_value: number | string
    contract_address: string
    fee_limit: number
    function_selector: string
    owner_address: string
    raw_parameter: string
}

export type BuildChangellyTradeTxResult =
    | {
          type: 'evm'
          tx: { chainId: number; to: string; value: string; data: string }
          changelly: ChangellyTransactionData
      }
    | { type: 'tron'; tx: TronTxData; changelly: ChangellyTransactionData }
    | { type: 'solana'; tx: { instructions: string }; changelly: ChangellyTransactionData }
    | { type: 'ton'; tx: TonTransactionData; changelly: ChangellyTransactionData }

export async function buildChangellyTradeTx(
    symbiosis: Symbiosis,
    params: BuildChangellyTradeTxParams
): Promise<BuildChangellyTradeTxResult> {
    const { token } = params.tokenAmountIn
    const chainId = token.chainId

    if (!isTonChainId(chainId) && !isSolanaChainId(chainId) && !isTronChainId(chainId) && !isEvmChainId(chainId)) {
        throw new ChangellyError(`Unsupported source chain: ${chainId}`)
    }

    const changellyData = await createChangellyDeposit(symbiosis, {
        currencyFrom: params.currencyFrom,
        currencyTo: params.currencyTo,
        amountFrom: params.amountFrom,
        rateId: params.rateId,
        address: params.address,
        refundAddress: params.refundAddress,
        extraIdTo: params.extraIdTo,
    })

    const { depositAddress } = changellyData
    const amount = params.tokenAmountIn.raw.toString()

    if (isTonChainId(chainId)) {
        const tx = await buildTonTransfer(symbiosis, depositAddress, params.tokenAmountIn, params.from)
        return { type: 'ton', tx, changelly: changellyData }
    }

    if (isSolanaChainId(chainId)) {
        const instructions = await buildSolanaTransfer(params.from, depositAddress, params.tokenAmountIn)
        return { type: 'solana', tx: { instructions }, changelly: changellyData }
    }

    if (isTronChainId(chainId)) {
        const tx = buildTronTransfer(depositAddress, token, amount, params.from)
        return { type: 'tron', tx, changelly: changellyData }
    }

    const tx = buildEvmTransfer(depositAddress, token, amount, chainId)
    return { type: 'evm', tx, changelly: changellyData }
}

// --- Helpers ---
function throwPairLimitError(params: PairsParamsResponse, amountFrom: string, symbol: string): void {
    const amount = Number(amountFrom)
    const minAmount = Number(params.minAmountFixed)
    const maxAmount = Number(params.maxAmountFixed)

    if (minAmount && amount < minAmount) {
        throw new AmountTooLowError(`Minimum amount is ${minAmount} ${symbol}`)
    }
    if (maxAmount && amount > maxAmount) {
        throw new AmountTooHighError(`Maximum amount is ${maxAmount} ${symbol}`)
    }
}

// Applies known symbol/name for Changelly-exclusive input tokens (XMR, LTC, etc.)
// For EVM/Solana/TON tokens the caller already provides proper metadata — return as-is.
function resolveInputToken(token: Token, currencyFrom: string): Token {
    const display = CHANGELLY_NATIVE_CHAINS.find((nativeChain) => nativeChain.ticker === currencyFrom.toLowerCase())
    if (!display) return token
    if (token.symbol === display.symbol && token.name === display.name) return token
    return new Token({
        chainId: token.chainId,
        address: token.address ?? '',
        decimals: token.decimals ?? CHANGELLY_NATIVE_DECIMALS[token.chainId] ?? 18,
        symbol: display.symbol,
        name: display.name,
        icons: token.icons ?? GAS_TOKEN[token.chainId]?.icons,
    })
}

function resolveOutputToken(tokenOut: Token, currencyTo: string): Token {
    const display = CHANGELLY_NATIVE_CHAINS.find((nativeChain) => nativeChain.ticker === currencyTo.toLowerCase())
    const knownName = display?.name
    const knownSymbol = display?.symbol
    const icons = tokenOut.icons ?? GAS_TOKEN[tokenOut.chainId]?.icons

    if (tokenOut.decimals !== undefined && tokenOut.decimals > 0) {
        // Apply known name even when token already has decimals (e.g. frontend-constructed tokens
        // for Changelly-exclusive chains may have decimals but symbol-only names like 'XMR')
        if (knownName && tokenOut.name !== knownName) {
            return new Token({
                chainId: tokenOut.chainId,
                address: tokenOut.address ?? '',
                decimals: tokenOut.decimals,
                symbol: knownSymbol ?? tokenOut.symbol ?? currencyTo.toUpperCase(),
                name: knownName,
                icons,
            })
        }
        return tokenOut
    }

    const decimals = CHANGELLY_NATIVE_DECIMALS[tokenOut.chainId] ?? 18
    const symbol = knownSymbol ?? currencyTo.toUpperCase()
    return new Token({
        chainId: tokenOut.chainId,
        address: '',
        decimals,
        symbol,
        name: knownName ?? symbol,
        icons,
    })
}

function buildFees(networkFee: string | undefined, tokenOut: Token): FeeItem[] {
    const fee = networkFee || '0'
    if (Number(fee) <= 0) return []

    return [
        {
            provider: SymbiosisTradeType.CHANGELLY,
            value: new TokenAmount(tokenOut, parseUnits(fee, tokenOut.decimals).toString()),
            description: 'Changelly network fee',
        },
    ]
}

const erc20Interface = new Interface(['function transfer(address to, uint256 amount)'])

function buildEvmTransfer(
    depositAddress: string,
    token: Token,
    amount: string,
    chainId: number
): { chainId: number; to: string; value: string; data: string } {
    if (token.isNative) {
        return { chainId, to: depositAddress, value: amount, data: '0x' }
    }

    return {
        chainId,
        to: token.address,
        value: '0',
        data: erc20Interface.encodeFunctionData('transfer', [depositAddress, amount]),
    }
}

function buildTronTransfer(depositAddress: string, token: Token, amount: string, ownerAddress: string): TronTxData {
    // ownerAddress arrives as EVM hex (converted upstream by tronAddressToEvm).
    // TronWeb requires base58 for owner_address — convert back.
    const ownerBase58 = TronWeb.address.fromHex(ownerAddress)

    if (token.isNative) {
        return {
            chain_id: token.chainId,
            call_value: amount,
            contract_address: depositAddress,
            fee_limit: TRON_TRANSFER_FEE_LIMIT,
            function_selector: '',
            owner_address: ownerBase58,
            raw_parameter: '',
        }
    }

    const toParam = TronWeb.address.toHex(depositAddress).replace(/^41/, '').padStart(64, '0')
    const amountParam = BigInt(amount).toString(16).padStart(64, '0')
    return {
        chain_id: token.chainId,
        call_value: 0,
        contract_address: TronWeb.address.fromHex(token.address),
        fee_limit: TRON_TRANSFER_FEE_LIMIT,
        function_selector: 'transfer(address,uint256)',
        owner_address: ownerBase58,
        raw_parameter: `${toParam}${amountParam}`,
    }
}

async function buildSolanaTransfer(from: string, depositAddress: string, tokenAmountIn: TokenAmount): Promise<string> {
    const connection = getSolanaConnection()
    const fromPubkey = new PublicKey(from)
    const toPubkey = new PublicKey(depositAddress)
    const amount = BigInt(tokenAmountIn.raw.toString())

    const instructions = []
    if (tokenAmountIn.token.isNative) {
        instructions.push(SystemProgram.transfer({ fromPubkey, toPubkey, lamports: amount }))
    } else {
        const mint = new PublicKey(tokenAmountIn.token.solAddress)

        // Detect token program: SPL Token or Token-2022
        const mintAccountInfo = await connection.getAccountInfo(mint)
        const programId = mintAccountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
            ? TOKEN_2022_PROGRAM_ID
            : TOKEN_PROGRAM_ID

        const sourceAta = getAssociatedTokenAddressSync(mint, fromPubkey, false, programId)
        const destAta = getAssociatedTokenAddressSync(mint, toPubkey, true, programId)
        instructions.push(
            createAssociatedTokenAccountIdempotentInstruction(fromPubkey, destAta, toPubkey, mint, programId)
        )
        instructions.push(createTransferInstruction(sourceAta, destAta, fromPubkey, amount, [], programId))
    }

    const { blockhash } = await connection.getLatestBlockhash()
    const message = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: blockhash,
        instructions,
    }).compileToV0Message()

    return Buffer.from(new VersionedTransaction(message).serialize()).toString('base64')
}

const TON_FORWARD_AMOUNT = '50000000' // 0.05 TON — covers notification processing on recipient contract
const TON_JETTON_TRANSFER_AMOUNT = '100000000' // 0.1 TON for gas on jetton transfer

async function buildTonTransfer(
    symbiosis: Symbiosis,
    depositAddress: string,
    tokenAmountIn: TokenAmount,
    from: string
): Promise<TonTransactionData> {
    const validUntil = Math.floor(Date.now() / 1000) + TON_TX_VALIDITY_SECONDS

    if (tokenAmountIn.token.isNative) {
        return {
            validUntil,
            messages: [
                {
                    address: depositAddress,
                    amount: tokenAmountIn.raw.toString(),
                },
            ],
        }
    }

    // Jetton transfer
    const tonTokenAddress = tokenAmountIn.token.tonAddress
    const jettonMaster = JettonMaster.create(Address.parse(tonTokenAddress))
    const tonClient = await symbiosis.getTonClient()
    const provider = tonClient.provider(jettonMaster.address)
    const jettonWalletAddress = await jettonMaster.getWalletAddress(provider, Address.parse(from))

    const payload = beginCell()
        .storeUint(0x0f8a7ea5, 32) // jetton transfer opcode
        .storeUint(0, 64) // query id
        .storeCoins(BigInt(tokenAmountIn.raw.toString()))
        .storeAddress(Address.parse(depositAddress)) // destination
        .storeAddress(Address.parse(from)) // response_destination for excess TON
        .storeBit(0) // no custom payload
        .storeCoins(BigInt(TON_FORWARD_AMOUNT)) // forward amount
        .storeBit(0) // no forward payload
        .endCell()

    return {
        validUntil,
        messages: [
            {
                address: jettonWalletAddress.toString(),
                amount: TON_JETTON_TRANSFER_AMOUNT,
                payload: payload.toBoc().toString('base64'),
            },
        ],
    }
}

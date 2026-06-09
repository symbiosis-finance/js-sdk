import type { StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, utils } from 'ethers'

import { Percent } from '../../entities'
import type { TokenAmount } from '../../entities'
import { ERC20__factory } from '../contracts'
import type { Logger } from '../types'

// Quotes whose positive price impact (user appears to "profit") exceeds this
// threshold look "too good to be true" — only those are simulated. A small margin
// avoids paying for simulation on normal oracle/quote noise. Shared by all aggregator
// trades so the limit lives in a single place.
const OPTIMISTIC_PRICE_IMPACT_THRESHOLD = new Percent('2', '1000') // 0.2%

const MAX_UINT256 = '0x' + 'ff'.repeat(32)

// A recognizable, non-trivial value written into a candidate storage slot during
// slot detection. If `balanceOf`/`allowance` reads it back, we found the right slot.
const SENTINEL = utils.hexZeroPad('0xdeadbeef', 32)

// How many leading storage slots to scan when probing the balances/allowances
// mappings. Standard OZ tokens use slots 0/1; proxies like USDC sit higher
// (FiatTokenV2 keeps balances at slot 9, allowances at slot 10).
const MAX_SLOTS_TO_SCAN = 20

// Lazily created so merely importing this module never touches the `ERC20__factory`
// export (some tests fully mock `../contracts` without it).
let erc20InterfaceCache: ReturnType<typeof ERC20__factory.createInterface> | undefined
function erc20Interface() {
    if (!erc20InterfaceCache) {
        erc20InterfaceCache = ERC20__factory.createInterface()
    }
    return erc20InterfaceCache
}

// Cache of detected slot indices per token. `null` means "fully scanned, not a
// standard layout" — we skip validation for it instead of rescanning every time.
// Infra failures (RPC without state-override support) are NOT cached, so they retry.
const slotCache = new Map<string, { balanceSlot: number; allowanceSlot: number } | null>()

export type CallDataValidationResult =
    | { status: 'valid' }
    | { status: 'reverted'; reason: string }
    | { status: 'skipped'; reason: string }

/**
 * Validates that a DEX-aggregator swap calldata can actually execute on-chain by
 * simulating it via `eth_call` with a state override that funds the sender.
 *
 * Cross-chain destination swaps are built before the sender contract holds any
 * liquidity, so we override its balance (and allowance to the router) to mimic the
 * post-bridge state. This catches "overly optimistic" quotes whose calldata reverts
 * in reality (e.g. routed through phantom liquidity).
 *
 * Never throws. Returns one of:
 *  - `valid`   — calldata executed fine.
 *  - `reverted`— calldata reverts on-chain; the caller should discard the quote.
 *  - `skipped` — could not validate (unknown token storage layout, or RPC without
 *                state-override support). We never reject a quote just because we
 *                could not simulate it.
 *
 * @param from Address that executes the swap on-chain (the `from` the calldata was
 *             built for — for cross-chain swaps this is the executing contract, NOT
 *             the end user).
 */
export async function validateCallData(
    provider: StaticJsonRpcProvider,
    from: string,
    routerAddress: string,
    callData: string,
    tokenAmountIn: TokenAmount
): Promise<CallDataValidationResult> {
    try {
        if (tokenAmountIn.token.isNative) {
            // Native token: override the caller's ETH balance — full simulation of the swap.
            const hexValue = '0x' + BigInt(tokenAmountIn.raw.toString()).toString(16)
            await provider.send('eth_call', [
                { from, to: routerAddress, value: hexValue, data: callData },
                'latest',
                { [from]: { balance: MAX_UINT256 } },
            ])
            return { status: 'valid' }
        }

        const tokenAddress = tokenAmountIn.token.address
        const slots = await getSlots(provider, tokenAmountIn.token.chainId, tokenAddress, from, routerAddress)
        if (!slots) {
            // Non-standard storage layout (or RPC can't simulate) — cannot validate.
            return { status: 'skipped', reason: 'unknown token storage layout' }
        }

        await provider.send('eth_call', [
            { from, to: routerAddress, data: callData },
            'latest',
            {
                [tokenAddress]: {
                    stateDiff: {
                        [balanceSlotKey(from, slots.balanceSlot)]: MAX_UINT256,
                        [allowanceSlotKey(from, routerAddress, slots.allowanceSlot)]: MAX_UINT256,
                    },
                },
            },
        ])
        return { status: 'valid' }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        if (isRevert(message)) {
            return { status: 'reverted', reason: message }
        }
        // Infra error (e.g. RPC without state-override support) — cannot validate.
        return { status: 'skipped', reason: message }
    }
}

function isRevert(message: string): boolean {
    return message.toLowerCase().includes('revert')
}

export interface OptimisticQuoteCheck {
    provider: StaticJsonRpcProvider
    logger?: Logger
    // Human-readable provider name for logs (e.g. '1inch', 'OpenOcean').
    providerName: string
    // Address the calldata was built to execute as (provider-specific: 1inch uses its
    // request `from`, OpenOcean uses the `account` it was quoted for).
    from: string
    routerAddress: string
    callData: string
    tokenAmountIn: TokenAmount
    amountOut: TokenAmount
    priceImpact: Percent
}

/**
 * Gated calldata validation for aggregator trades. Simulates the calldata only when
 * the quote's price impact is suspiciously positive, logs the outcome, and throws
 * when the calldata reverts on-chain (so the caller can drop the quote). Returns
 * silently when the quote is below the threshold or could not be simulated.
 */
export async function validateOptimisticQuote(check: OptimisticQuoteCheck): Promise<void> {
    const { provider, logger, providerName, from, routerAddress, callData, tokenAmountIn, amountOut, priceImpact } =
        check

    if (!priceImpact.greaterThan(OPTIMISTIC_PRICE_IMPACT_THRESHOLD)) {
        return
    }

    const context =
        `${providerName} optimistic quote ${tokenAmountIn.token.symbol}->${amountOut.token.symbol} ` +
        `chainId=${tokenAmountIn.token.chainId} priceImpact=${priceImpact.toSignificant(4)}% ` +
        `amountIn=${tokenAmountIn.toSignificant()} amountOut=${amountOut.toSignificant()}`

    const result = await validateCallData(provider, from, routerAddress, callData, tokenAmountIn)

    if (result.status === 'reverted') {
        logger?.warn(`Calldata validation failed (reverted), discarding ${context}. Reason: ${result.reason}`)
        throw new Error(`Optimistic quote rejected: calldata reverts on-chain (${result.reason})`)
    }
    if (result.status === 'skipped') {
        logger?.info(`Calldata validation skipped for ${context}. Reason: ${result.reason}`)
        return
    }
    logger?.info(`Calldata validation passed for ${context}`)
}

// keccak256(abi.encode(holder, slot)) — storage key of balances[holder].
function balanceSlotKey(holder: string, slot: number): string {
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [holder, slot]))
}

// keccak256(abi.encode(spender, keccak256(abi.encode(owner, slot)))) — storage key
// of allowances[owner][spender] (a nested mapping).
function allowanceSlotKey(owner: string, spender: string, slot: number): string {
    const inner = utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [owner, slot]))
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'bytes32'], [spender, inner]))
}

async function getSlots(
    provider: StaticJsonRpcProvider,
    chainId: number,
    tokenAddress: string,
    holder: string,
    spender: string
): Promise<{ balanceSlot: number; allowanceSlot: number } | null> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`
    const cached = slotCache.get(cacheKey)
    if (cached !== undefined) {
        return cached
    }

    let balanceSlot: number | null
    let allowanceSlot: number | null
    try {
        balanceSlot = await findBalanceSlot(provider, tokenAddress, holder)
        if (balanceSlot === null) {
            slotCache.set(cacheKey, null)
            return null
        }
        allowanceSlot = await findAllowanceSlot(provider, tokenAddress, holder, spender)
        if (allowanceSlot === null) {
            slotCache.set(cacheKey, null)
            return null
        }
    } catch {
        // Infra error during probing (override unsupported, RPC issue) — don't cache, retry later.
        return null
    }

    const result = { balanceSlot, allowanceSlot }
    slotCache.set(cacheKey, result)
    return result
}

async function findBalanceSlot(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    holder: string
): Promise<number | null> {
    const data = erc20Interface().encodeFunctionData('balanceOf', [holder])
    for (let slot = 0; slot < MAX_SLOTS_TO_SCAN; slot++) {
        // A throw here propagates (infra/override-unsupported) and aborts detection.
        const ret = await provider.send('eth_call', [
            { to: tokenAddress, data },
            'latest',
            { [tokenAddress]: { stateDiff: { [balanceSlotKey(holder, slot)]: SENTINEL } } },
        ])
        if (readsBackSentinel(ret)) {
            return slot
        }
    }
    return null
}

async function findAllowanceSlot(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    owner: string,
    spender: string
): Promise<number | null> {
    const data = erc20Interface().encodeFunctionData('allowance', [owner, spender])
    for (let slot = 0; slot < MAX_SLOTS_TO_SCAN; slot++) {
        const ret = await provider.send('eth_call', [
            { to: tokenAddress, data },
            'latest',
            { [tokenAddress]: { stateDiff: { [allowanceSlotKey(owner, spender, slot)]: SENTINEL } } },
        ])
        if (readsBackSentinel(ret)) {
            return slot
        }
    }
    return null
}

function readsBackSentinel(returnData: string): boolean {
    try {
        // balanceOf/allowance both return a single uint256 — decode generically.
        const [value] = utils.defaultAbiCoder.decode(['uint256'], returnData) as [BigNumber]
        return value.eq(BigNumber.from(SENTINEL))
    } catch {
        return false
    }
}

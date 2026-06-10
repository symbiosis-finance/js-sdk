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

// Value written into the balance storage slot to fund the sender. We deliberately
// leave the top bit clear (2^255 - 1 instead of MAX_UINT256): FiatTokenV2_2 (e.g.
// native USDC on Arbitrum/Base) packs the blacklist flag into the high bit of the
// balance slot (`balanceAndBlacklistStates`), so a full-0xff override would mark the
// sender as blacklisted and make every `transferFrom` revert (SafeTransferFromFailed,
// 0xf4059071). 2^255 - 1 is still effectively unlimited balance and is harmless for
// plain OZ tokens that read the whole 256-bit slot.
const MAX_BALANCE_OVERRIDE = '0x7f' + 'ff'.repeat(31)

// A recognizable, non-trivial value written into a candidate storage slot during
// slot detection. If `balanceOf`/`allowance` reads it back, we found the right slot.
// Like the funding value, its top bit is clear so the FiatToken blacklist flag stays
// off during detection.
const SENTINEL = utils.hexZeroPad('0xdeadbeef', 32)

// How many leading storage slots to scan when probing the balances/allowances
// mappings. Standard OZ tokens use slots 0/1; proxies sit higher: FiatTokenV2
// (native USDC) keeps balances at slot 9 / allowances at slot 10, and the
// Coinbase-bridged token implementation (e.g. USDbC on Base) puts balances at
// slot 51 / allowances at slot 52. Keep enough headroom above the highest known
// layout so these tokens are detected instead of skipped.
const MAX_SLOTS_TO_SCAN = 64

// ERC-7201 namespaced storage (OpenZeppelin Contracts v5 `ERC20Upgradeable`, used by
// e.g. oUSDT on Base and UETH on HyperEVM). The balances/allowances mappings live
// under a pseudo-random base slot, NOT a small integer, so the linear scan above can
// never reach them — we probe this known base explicitly. Derivation:
//   base = keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ERC20")) - 1)) & ~0xff
// `ERC20Storage` struct order is `_balances` (base), `_allowances` (base + 1),
// `_totalSupply`, `_name`, `_symbol`.
const OZ_ERC20_NAMESPACE_BASE = BigNumber.from('0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00')

// Candidate base slots for the balances mapping: the leading integer slots plus the
// ERC-7201 namespace base. Ordered so the cheap common layouts win first.
function balanceSlotCandidates(): BigNumber[] {
    const candidates: BigNumber[] = []
    for (let slot = 0; slot < MAX_SLOTS_TO_SCAN; slot++) {
        candidates.push(BigNumber.from(slot))
    }
    candidates.push(OZ_ERC20_NAMESPACE_BASE)
    return candidates
}

// Same as above for allowances; under ERC-7201 the allowances mapping sits one slot
// after balances (base + 1).
function allowanceSlotCandidates(): BigNumber[] {
    const candidates: BigNumber[] = []
    for (let slot = 0; slot < MAX_SLOTS_TO_SCAN; slot++) {
        candidates.push(BigNumber.from(slot))
    }
    candidates.push(OZ_ERC20_NAMESPACE_BASE.add(1))
    return candidates
}

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
const slotCache = new Map<string, { balanceSlot: BigNumber; allowanceSlot: BigNumber } | null>()

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
                        [balanceSlotKey(from, slots.balanceSlot)]: MAX_BALANCE_OVERRIDE,
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
        `${providerName} quote ${tokenAmountIn.token.symbol}(${tokenAmountIn.token.address})->${amountOut.token.symbol}(${amountOut.token.address}) ` +
        `chainId=${tokenAmountIn.token.chainId} priceImpact=${priceImpact.toSignificant(4)}% ` +
        `amountIn=${tokenAmountIn.toSignificant()} amountOut=${amountOut.toSignificant()}`

    const result = await validateCallData(provider, from, routerAddress, callData, tokenAmountIn)

    if (result.status === 'reverted') {
        throw new Error(`Optimistic quote rejected for ${context}. Calldata reverts on-chain (${result.reason})`)
    }
    if (result.status === 'skipped') {
        logger?.warn(`Optimistic quote skipped for ${context}. Reason: ${result.reason}`)
        return
    }
    logger?.info(`Optimistic quote passed for ${context}`)
}

// keccak256(abi.encode(holder, slot)) — storage key of balances[holder].
function balanceSlotKey(holder: string, slot: BigNumber): string {
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [holder, slot]))
}

// keccak256(abi.encode(spender, keccak256(abi.encode(owner, slot)))) — storage key
// of allowances[owner][spender] (a nested mapping).
function allowanceSlotKey(owner: string, spender: string, slot: BigNumber): string {
    const inner = utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [owner, slot]))
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'bytes32'], [spender, inner]))
}

async function getSlots(
    provider: StaticJsonRpcProvider,
    chainId: number,
    tokenAddress: string,
    holder: string,
    spender: string
): Promise<{ balanceSlot: BigNumber; allowanceSlot: BigNumber } | null> {
    const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`
    const cached = slotCache.get(cacheKey)
    if (cached !== undefined) {
        return cached
    }

    let balanceSlot: BigNumber | null
    let allowanceSlot: BigNumber | null
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
): Promise<BigNumber | null> {
    const data = erc20Interface().encodeFunctionData('balanceOf', [holder])
    for (const slot of balanceSlotCandidates()) {
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
): Promise<BigNumber | null> {
    const data = erc20Interface().encodeFunctionData('allowance', [owner, spender])
    for (const slot of allowanceSlotCandidates()) {
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

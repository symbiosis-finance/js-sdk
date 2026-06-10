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

// Explicit gas limit for `eth_createAccessList` calls. Without it some nodes default
// to an enormous limit and reject the request because the (zero-address) sender can't
// afford `gas * gasPrice`. 2M is plenty for a view call.
const ACCESS_LIST_GAS = '0x1e8480'

// Concrete storage location of a mapping entry. The holding contract is usually the
// token itself, but eternal-storage tokens (e.g. KAON on Ethereum) keep balances and
// allowances in separate dedicated storage contracts — sometimes a different one per
// mapping — so the address must travel together with the key.
interface StorageRef {
    address: string
    key: string
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

// Cache of detected storage locations. The keys are holder/spender-specific (they are
// hashed into the storage key), so the cache key includes them; in practice holder and
// spender are stable per aggregator per chain, keeping cardinality low. `null` means
// "fully probed, layout not supported" — we skip validation instead of re-probing.
// Infra failures (RPC without state-override support) are NOT cached, so they retry.
const slotCache = new Map<string, { balance: StorageRef; allowance: StorageRef } | null>()

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
        const refs = await getStorageRefs(provider, tokenAmountIn.token.chainId, tokenAddress, from, routerAddress)
        if (!refs) {
            // Non-standard storage layout (or RPC can't simulate) — cannot validate.
            return { status: 'skipped', reason: 'unknown token storage layout' }
        }

        // Balance and allowance may live in different contracts (eternal storage) —
        // group the overrides by holding contract.
        const overrides: Record<string, { stateDiff: Record<string, string> }> = {}
        for (const { ref, value } of [
            { ref: refs.balance, value: MAX_BALANCE_OVERRIDE },
            { ref: refs.allowance, value: MAX_UINT256 },
        ]) {
            overrides[ref.address] = overrides[ref.address] ?? { stateDiff: {} }
            overrides[ref.address].stateDiff[ref.key] = value
        }

        await provider.send('eth_call', [{ from, to: routerAddress, data: callData }, 'latest', overrides])
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

    // The simulation runs at 'latest', which may differ from the state the aggregator
    // quoted against — record the block number so failures can be replayed precisely.
    let blockNumber: string
    try {
        blockNumber = BigNumber.from(await provider.send('eth_blockNumber', [])).toString()
    } catch {
        blockNumber = 'unknown'
    }

    const context =
        `${providerName} quote ${tokenAmountIn.token.symbol}(${tokenAmountIn.token.address})->${amountOut.token.symbol}(${amountOut.token.address}) ` +
        `chainId=${tokenAmountIn.token.chainId} block=${blockNumber} priceImpact=${priceImpact.toSignificant(4)}% ` +
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

async function getStorageRefs(
    provider: StaticJsonRpcProvider,
    chainId: number,
    tokenAddress: string,
    holder: string,
    spender: string
): Promise<{ balance: StorageRef; allowance: StorageRef } | null> {
    const cacheKey = `${chainId}:${tokenAddress}:${holder}:${spender}`.toLowerCase()
    const cached = slotCache.get(cacheKey)
    if (cached !== undefined) {
        return cached
    }

    let balance: StorageRef | null
    let allowance: StorageRef | null
    try {
        balance = await findBalanceRef(provider, tokenAddress, holder)
        if (balance === null) {
            slotCache.set(cacheKey, null)
            return null
        }
        allowance = await findAllowanceRef(provider, tokenAddress, holder, spender)
        if (allowance === null) {
            slotCache.set(cacheKey, null)
            return null
        }
    } catch {
        // Infra error during probing (override unsupported, RPC issue) — don't cache, retry later.
        return null
    }

    const result = { balance, allowance }
    slotCache.set(cacheKey, result)
    return result
}

// Writes the sentinel into `ref` and checks whether the view call reads it back.
// Throws propagate (infra/override-unsupported) so the caller can abort detection.
async function probesBackSentinel(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    data: string,
    ref: StorageRef
): Promise<boolean> {
    const ret = await provider.send('eth_call', [
        { to: tokenAddress, data },
        'latest',
        { [ref.address]: { stateDiff: { [ref.key]: SENTINEL } } },
    ])
    return readsBackSentinel(ret)
}

// Asks the node which (contract, slot) pairs the view call actually touches
// (`eth_createAccessList`), then sentinel-verifies each candidate. This finds the
// storage location in a handful of calls regardless of layout — including tokens
// whose balances live in a separate storage contract, which the linear scan over the
// token's own slots can never reach. Returns null when the method is unsupported or
// no candidate verifies; the caller then falls back to scanning.
async function findRefViaAccessList(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    data: string
): Promise<StorageRef | null> {
    let accessList: { address: string; storageKeys?: string[] }[]
    try {
        const res = await provider.send('eth_createAccessList', [
            { to: tokenAddress, data, gas: ACCESS_LIST_GAS },
            'latest',
        ])
        accessList = res?.accessList ?? []
    } catch {
        return null
    }
    for (const entry of accessList) {
        for (const key of entry.storageKeys ?? []) {
            const ref = { address: entry.address, key }
            try {
                if (await probesBackSentinel(provider, tokenAddress, data, ref)) {
                    return ref
                }
            } catch {
                // Overriding this slot broke the call (e.g. it is a proxy/storage
                // pointer, not a balance) — try the next candidate.
            }
        }
    }
    return null
}

async function findBalanceRef(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    holder: string
): Promise<StorageRef | null> {
    const data = erc20Interface().encodeFunctionData('balanceOf', [holder])
    const viaList = await findRefViaAccessList(provider, tokenAddress, data)
    if (viaList) {
        return viaList
    }
    for (const slot of balanceSlotCandidates()) {
        const ref = { address: tokenAddress, key: balanceSlotKey(holder, slot) }
        // A throw here propagates (infra/override-unsupported) and aborts detection.
        if (await probesBackSentinel(provider, tokenAddress, data, ref)) {
            return ref
        }
    }
    return null
}

async function findAllowanceRef(
    provider: StaticJsonRpcProvider,
    tokenAddress: string,
    owner: string,
    spender: string
): Promise<StorageRef | null> {
    const data = erc20Interface().encodeFunctionData('allowance', [owner, spender])
    const viaList = await findRefViaAccessList(provider, tokenAddress, data)
    if (viaList) {
        return viaList
    }
    for (const slot of allowanceSlotCandidates()) {
        const ref = { address: tokenAddress, key: allowanceSlotKey(owner, spender, slot) }
        if (await probesBackSentinel(provider, tokenAddress, data, ref)) {
            return ref
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

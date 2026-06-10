import type { StaticJsonRpcProvider } from '@ethersproject/providers'
import { BigNumber, utils } from 'ethers'
import type { BigNumberish } from 'ethers'
import { describe, expect, test, vi } from 'vitest'

import { ChainId } from '../../../src/constants'
import { ERC20__factory } from '../../../src/crosschain/contracts'
import { validateCallData, validateOptimisticQuote } from '../../../src/crosschain/trade/validateCallData'
import { Percent, Token, TokenAmount } from '../../../src/entities'

const MAX_UINT256 = '0x' + 'ff'.repeat(32)
// Mirror of MAX_BALANCE_OVERRIDE in validateCallData.ts: top bit clear so the
// FiatToken blacklist flag is not set when funding the sender.
const MAX_BALANCE_OVERRIDE = '0x7f' + 'ff'.repeat(31)
// Mirror of OZ_ERC20_NAMESPACE_BASE in validateCallData.ts: the ERC-7201 base slot of
// OpenZeppelin v5 `ERC20Upgradeable` (balances at base, allowances at base + 1).
const OZ_ERC20_NAMESPACE_BASE = BigNumber.from('0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00')
const FROM = '0x1111111111111111111111111111111111111111'
const ROUTER = '0x2222222222222222222222222222222222222222'
const SWAP_CALLDATA = '0xdeadbeef'

const erc20 = ERC20__factory.createInterface()
const BALANCE_OF_SIGHASH = erc20.getSighash('balanceOf')
const ALLOWANCE_SIGHASH = erc20.getSighash('allowance')

// Mirror of the (private) storage-key derivation in validateCallData.ts so the mock
// can pretend balances/allowances live at specific slots.
function balanceSlotKey(holder: string, slot: BigNumberish): string {
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [holder, slot]))
}
function allowanceSlotKey(owner: string, spender: string, slot: BigNumberish): string {
    const inner = utils.keccak256(utils.defaultAbiCoder.encode(['address', 'uint256'], [owner, slot]))
    return utils.keccak256(utils.defaultAbiCoder.encode(['address', 'bytes32'], [spender, inner]))
}

// Each test uses a unique token address to avoid the module-level slot cache leaking
// detection results between cases.
let tokenCounter = 0
function nextTokenAddress(): string {
    tokenCounter += 1
    return utils.hexZeroPad('0x' + tokenCounter.toString(16), 20)
}

interface StorageRef {
    address: string
    key: string
}

interface MockOptions {
    balanceSlot?: BigNumberish
    allowanceSlot?: BigNumberish
    swapReverts?: boolean
    // When false, the mock fails any eth_call that carries a state override, simulating
    // an RPC that does not support overrides at all.
    supportsOverride?: boolean
    // Models FiatTokenV2_2 (USDC), which packs a blacklist flag into the high bit of the
    // balance slot: if the funding value has the top bit set, the account is "blacklisted"
    // and the swap's transferFrom reverts (SafeTransferFromFailed).
    blacklistOnTopBit?: boolean
    // Eternal-storage mode: balances/allowances live at these fixed locations (possibly
    // in contracts other than the token), instead of slot-derived keys on the token.
    externalBalance?: StorageRef
    externalAllowance?: StorageRef
    // Access list the node reports for view calls. When undefined the mock rejects
    // eth_createAccessList, exercising the linear-scan fallback.
    accessList?: { address: string; storageKeys: string[] }[]
}

/**
 * Builds a provider whose ERC20 storage layout keeps balances at `balanceSlot` and
 * allowances at `allowanceSlot` (or at the fixed external locations). The final swap
 * call to the router only succeeds if it was funded at the correct storage location —
 * so a `valid` result proves detection found the right slots.
 */
function makeProvider(token: string, opts: MockOptions) {
    const {
        balanceSlot = 0,
        allowanceSlot = 1,
        swapReverts = false,
        supportsOverride = true,
        blacklistOnTopBit = false,
        externalBalance,
        externalAllowance,
        accessList,
    } = opts

    const balanceLoc = (holder: string): StorageRef =>
        externalBalance ?? { address: token, key: balanceSlotKey(holder, balanceSlot) }
    const allowanceLoc = (owner: string, spender: string): StorageRef =>
        externalAllowance ?? { address: token, key: allowanceSlotKey(owner, spender, allowanceSlot) }

    const send = vi.fn(async (method: string, params: unknown[]) => {
        if (method === 'eth_blockNumber') {
            return '0x112a880' // 18_000_000
        }
        if (method === 'eth_createAccessList') {
            if (!accessList) {
                throw new Error('the method eth_createAccessList does not exist/is not available')
            }
            return { accessList }
        }

        expect(method).toBe('eth_call')
        const [tx, block, overrides] = params as [
            { to: string; data: string },
            string,
            Record<string, { stateDiff?: Record<string, string> }> | undefined,
        ]
        expect(block).toBe('latest')

        if (!supportsOverride && overrides) {
            throw new Error('the method eth_call does not support state overrides')
        }

        // Address keys in overrides may be checksummed (EIP-55) — match case-insensitively.
        const readDiff = (ref: StorageRef): string | undefined => {
            const entry = Object.entries(overrides ?? {}).find(
                ([address]) => address.toLowerCase() === ref.address.toLowerCase()
            )
            return entry?.[1]?.stateDiff?.[ref.key]
        }
        const selector = tx.data.slice(0, 10)
        // The Token entity checksums addresses (EIP-55), the mock's are lowercase.
        const isToken = tx.to.toLowerCase() === token.toLowerCase()

        // Balance probe: return whatever was written to the true balance location.
        if (isToken && selector === BALANCE_OF_SIGHASH) {
            const [holder] = erc20.decodeFunctionData('balanceOf', tx.data)
            const written = readDiff(balanceLoc(holder))
            const value = written ? BigNumber.from(written) : BigNumber.from(0)
            return erc20.encodeFunctionResult('balanceOf', [value])
        }

        // Allowance probe.
        if (isToken && selector === ALLOWANCE_SIGHASH) {
            const [owner, spender] = erc20.decodeFunctionData('allowance', tx.data)
            const written = readDiff(allowanceLoc(owner, spender))
            const value = written ? BigNumber.from(written) : BigNumber.from(0)
            return erc20.encodeFunctionResult('allowance', [value])
        }

        // The final swap simulation against the router.
        if (tx.to === ROUTER) {
            if (swapReverts) {
                throw new Error('execution reverted: insufficient liquidity')
            }
            const balanceOverride = readDiff(balanceLoc(FROM))
            if (blacklistOnTopBit && balanceOverride && !BigNumber.from(balanceOverride).shr(255).isZero()) {
                // FiatTokenV2_2: top bit set => blacklisted => transferFrom reverts.
                throw new Error('execution reverted: SafeTransferFromFailed()')
            }
            const fundedBalance = balanceOverride === MAX_BALANCE_OVERRIDE
            const fundedAllowance = readDiff(allowanceLoc(FROM, ROUTER)) === MAX_UINT256
            if (!fundedBalance || !fundedAllowance) {
                throw new Error('execution reverted: ERC20: transfer amount exceeds balance')
            }
            return '0x'
        }

        throw new Error(`unexpected eth_call to ${tx.to}`)
    })

    return { send } as unknown as StaticJsonRpcProvider
}

function makeTokenAmount(address: string): TokenAmount {
    const token = new Token({ chainId: ChainId.ETH_MAINNET, address, decimals: 18, symbol: 'TKN' })
    return new TokenAmount(token, '1000000000000000000')
}

describe('validateCallData slot detection', () => {
    test('detects standard OZ layout (balances slot 0, allowances slot 1)', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 0, allowanceSlot: 1 })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('detects proxy layout (USDC-like: balances slot 9, allowances slot 10)', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 9, allowanceSlot: 10 })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('detects independent balance/allowance slots', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 3, allowanceSlot: 7 })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('detects Coinbase-bridged layout (USDbC-like: balances slot 51, allowances slot 52)', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 51, allowanceSlot: 52 })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('funds with the top bit clear so FiatTokenV2_2 does not flag the sender as blacklisted', async () => {
        const token = nextTokenAddress()
        // balances slot 9 mirrors native USDC; blacklistOnTopBit reverts the swap if the
        // funding value sets the high bit (the bug a MAX_UINT256 override used to trigger).
        const provider = makeProvider(token, { balanceSlot: 9, allowanceSlot: 10, blacklistOnTopBit: true })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('detects ERC-7201 namespaced layout (OZ v5: balances at base slot, allowances at base+1)', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, {
            balanceSlot: OZ_ERC20_NAMESPACE_BASE,
            allowanceSlot: OZ_ERC20_NAMESPACE_BASE.add(1),
        })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('skips when slots are out of the scan range', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 70, allowanceSlot: 71 })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result.status).toBe('skipped')
    })

    test('detects eternal-storage tokens via access list (balances in external contracts)', async () => {
        const token = nextTokenAddress()
        // KAON-like: balances and allowances live in two separate storage contracts; the
        // linear scan over the token's own slots can never find them.
        const balanceStore = nextTokenAddress()
        const allowanceStore = nextTokenAddress()
        const externalBalance = { address: balanceStore, key: utils.keccak256(utils.toUtf8Bytes('balances')) }
        const externalAllowance = { address: allowanceStore, key: utils.keccak256(utils.toUtf8Bytes('allowed')) }
        const provider = makeProvider(token, {
            externalBalance,
            externalAllowance,
            accessList: [
                // Decoy the detector must reject: the token's own storage-pointer slot.
                { address: token, storageKeys: [utils.hexZeroPad('0x0', 32)] },
                { address: balanceStore, storageKeys: [externalBalance.key] },
                { address: allowanceStore, storageKeys: [externalAllowance.key] },
            ],
        })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('falls back to the slot scan when the access list is empty', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 9, allowanceSlot: 10, accessList: [] })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result).toEqual({ status: 'valid' })
    })

    test('reports reverted when the swap reverts despite funding', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 0, allowanceSlot: 1, swapReverts: true })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result.status).toBe('reverted')
    })

    test('skips when the RPC does not support state overrides', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 0, allowanceSlot: 1, supportsOverride: false })

        const result = await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))

        expect(result.status).toBe('skipped')
    })

    test('caches detected slots per token (no re-scan on second call)', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 5, allowanceSlot: 6 })
        const send = provider.send as unknown as ReturnType<typeof vi.fn>

        await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))
        const callsAfterFirst = send.mock.calls.length

        await validateCallData(provider, FROM, ROUTER, SWAP_CALLDATA, makeTokenAmount(token))
        const callsAfterSecond = send.mock.calls.length

        // Second run reuses cached slots: only the single final swap simulation runs.
        expect(callsAfterSecond - callsAfterFirst).toBe(1)
    })
})

describe('validateOptimisticQuote logging', () => {
    test('log context includes the block number the simulation ran at', async () => {
        const token = nextTokenAddress()
        const provider = makeProvider(token, { balanceSlot: 0, allowanceSlot: 1 })
        const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }

        await validateOptimisticQuote({
            provider,
            logger,
            providerName: '1inch',
            from: FROM,
            routerAddress: ROUTER,
            callData: SWAP_CALLDATA,
            tokenAmountIn: makeTokenAmount(token),
            amountOut: makeTokenAmount(nextTokenAddress()),
            priceImpact: new Percent('3', '1000'), // 0.3% > 0.2% threshold
        })

        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.info.mock.calls[0][0]).toContain('block=18000000')
    })
})

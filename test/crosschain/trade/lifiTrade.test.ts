import { BigNumber } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { LifiTrade } from '../../../src/crosschain/trade/lifiTrade'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'

describe('LifiTrade', () => {
    describe('isAvailable', () => {
        test('supported chains', () => {
            expect(LifiTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(LifiTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
        })

        test('unsupported chains', () => {
            expect(LifiTrade.isAvailable(ChainId.TRON_MAINNET)).toBe(false)
        })
    })

    describe('tradeType', () => {
        const tokenIn = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDC',
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
        })
        const tokenOut = new Token({
            chainId: ChainId.ETH_MAINNET,
            symbol: 'USDT',
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            decimals: 6,
        })
        const trade = new LifiTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: {} as any,
        })

        test('returns lifi', () => {
            expect(trade.tradeType).toEqual('lifi')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    describe('findValueOffset', () => {
        test('finds a value embedded in calldata', () => {
            const value = BigNumber.from('123456789012345678')
            const callData =
                '0x' + 'aabbccdd' + '0'.repeat(64) + value.toHexString().slice(2).padStart(64, '0') + '0'.repeat(64)
            const offset = LifiTrade.findValueOffset(callData, value.toString())

            expect(offset).toBeGreaterThan(0)
            expect(SymbiosisTrade.getAmountFromCallData(callData, offset)).toEqual(value)
        })

        test('returns 0 for zero value', () => {
            expect(LifiTrade.findValueOffset('0x' + '00'.repeat(64), '0')).toBe(0)
        })

        test('returns 0 when value not found', () => {
            const callData = '0x' + 'ff'.repeat(64)
            expect(LifiTrade.findValueOffset(callData, '42')).toBe(0)
        })

        test('found offset is patchable round-trip', () => {
            const fromAmount = BigNumber.from('999888777666')
            const padding = '0'.repeat(128)
            const callData =
                '0xdeadbeef' + padding + fromAmount.toHexString().slice(2).padStart(64, '0') + padding
            const offset = LifiTrade.findValueOffset(callData, fromAmount.toString())

            const newAmount = BigNumber.from('500000000000')
            const patched = SymbiosisTrade.patchCallData(callData, offset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, offset)).toEqual(newAmount)
        })
    })

    describe('LiFi-Diamond synthetic shape (empirical offsets 516/164)', () => {
        // Mirrors the layout observed across many production same-chain quotes:
        // toAmountMin slot ends at byte 164, fromAmount slot ends at byte 516,
        // variable-length sub-DEX bytes follow afterwards.
        function buildLifiLikeCalldata(fromAmount: BigNumber, toAmountMin: BigNumber): string {
            const fromHex = fromAmount.toHexString().slice(2).padStart(64, '0')
            const minHex = toAmountMin.toHexString().slice(2).padStart(64, '0')
            const selector = '4666fc80'
            // After "0x" (chars 0..1) + selector (chars 2..9):
            //  - minHex must START at char 266 → END at 330 → offset (266+64-2)/2 = 164
            //  - fromHex must START at char 970 → END at 1034 → offset (970+64-2)/2 = 516
            const fillerBefore = 'a1'.repeat((266 - 10) / 2)
            const fillerMiddle = 'b2'.repeat((970 - 330) / 2)
            const fillerAfter = 'c3'.repeat(128)
            return '0x' + selector + fillerBefore + minHex + fillerMiddle + fromHex + fillerAfter
        }

        test('finds fromAmount at 516 and toAmountMin at 164', () => {
            const fromAmount = BigNumber.from('2407044354')
            const toAmountMin = BigNumber.from('2375062792843916628774')
            const callData = buildLifiLikeCalldata(fromAmount, toAmountMin)

            expect(LifiTrade.findValueOffset(callData, fromAmount.toString())).toBe(516)
            expect(LifiTrade.findValueOffset(callData, toAmountMin.toString())).toBe(164)
        })

        test('offsets round-trip cleanly through patchCallData', () => {
            const fromAmount = BigNumber.from('4000000000000000000')
            const toAmountMin = BigNumber.from('2107585634')
            const callData = buildLifiLikeCalldata(fromAmount, toAmountMin)

            const callDataOffset = LifiTrade.findValueOffset(callData, fromAmount.toString())
            const minReceivedOffset = LifiTrade.findValueOffset(callData, toAmountMin.toString())

            const newFromAmount = BigNumber.from('3500000000000000000')
            const newToAmountMin = BigNumber.from('1843887429')
            let patched = SymbiosisTrade.patchCallData(callData, callDataOffset, newFromAmount)
            patched = SymbiosisTrade.patchCallData(patched, minReceivedOffset, newToAmountMin)

            expect(SymbiosisTrade.getAmountFromCallData(patched, callDataOffset)).toEqual(newFromAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, minReceivedOffset)).toEqual(newToAmountMin)
        })

        test('fromAmount and toAmountMin land at distinct offsets', () => {
            const fromAmount = BigNumber.from('1000000000000000000')
            const toAmountMin = BigNumber.from('999000000000000000')
            const callData = buildLifiLikeCalldata(fromAmount, toAmountMin)

            const fromOffset = LifiTrade.findValueOffset(callData, fromAmount.toString())
            const minOffset = LifiTrade.findValueOffset(callData, toAmountMin.toString())

            expect(fromOffset).not.toEqual(minOffset)
        })
    })

    /**
     * Real production LiFi-Diamond calldata captured from on-chain transactions.
     * Each fixture is a direct call to LiFi-Diamond (to: 0x1231deb6...). Wrapped
     * calls (smart wallets / EntryPoint / Magpie cross-chain) are intentionally
     * excluded — our LifiTrade only consumes same-chain quote.transactionRequest.data.
     */
    interface RealCalldataFixture {
        label: string
        callData: string
        fromAmount: string
        toAmountMin: string
        expectedCallDataOffset: number
        expectedMinReceivedOffset: number
    }

    const REAL_LIFI_SAMPLES: RealCalldataFixture[] = [
        {
            // ethereum mainnet, USDT→USDC via LiFi-Diamond method 0x4630a0d8
            // https://etherscan.io/tx/0x15f0c0a51dbce27ab7081c06426177bfe80ecdc79004494930082dde8a831358
            label: 'eth mainnet USDT→USDC (selector 0x4630a0d8)',
            // eslint-disable-next-line max-len
            callData: '0x4630a0d89ff1304125fd0d891e2fba009e08dde464f1e7d2c6f49283ac556c0c3a4bb1a400000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000aa0463bb95922b82ae2c01a0348d2ccc48ec47e300000000000000000000000000000000000000000000000000000000729ae95b0000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000665786f6475730000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002a30783030303030303030303030303030303030303030303030303030303030303030303030303030303000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000240000000000000000000000000685527c551cc40ce1f1c9818cd8683307076e4ed000000000000000000000000685527c551cc40ce1f1c9818cd8683307076e4ed000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000774770fc00000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000e4332d746b000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c06ebbefd94032b85424d51906e2a335efae264b00000000000000000000000000000000000000000000000000000000002dcd9b0000000000000000000000000c036a08aee5136440f2b82d6769d9834aef0be40000000000000000000000000000000000000000000000000000000001038d1f00000000000000000000000000000000000000000000000000000000000000000000000000000000ac4c6e212a361c968f1725b4d055b47e63f80b75000000000000000000000000ac4c6e212a361c968f1725b4d055b47e63f80b75000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48000000000000000000000000000000000000000000000000000000007616164200000000000000000000000000000000000000000000000000000000000000e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003a45f3bd1c8000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec700000000000000000000000000000000000000000000000000000000761616420000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000000000000000000000000000000000000727d9299000000000000000000000000c10ee9031f2a0b84766a86b55a8d90f357910fb400000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000284ba3f2165000000000000000000000000de7259893af7cdbc9fd806c6ba61d22d581d566700000000000000000000000000000000000000000000000000000000001d56c2000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000076161642000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000076264cf20000000000000000000000001231deb6f5749ef6ce6943a275a1d3e7486f4eae0000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000118019e3b0932d5000301dac17f958d2ee523a2206206994597c13d831ec701ffff05000000000000000000000000000000000000000000000000000000000000003f29764a57b5764e641787b62d916b06de4c9bc2e3000100c10ee9031f2a0b84766a86b55a8d90f357910fb42260fac5e5542a773aa44fbcfedf7c193bc2c599ec2c0f9cd306012260fac5e5542a773aa44fbcfedf7c193bc2c59901ffff014585fe77225b41b697c938b018e2ac67ac5a20c001c10ee9031f2a0b84766a86b55a8d90f357910fb4009cd306cd2d2c01c02aaa39b223fe8d0a0e5c4f27ead9083c756cc201ffff01e0554a476a092703abdb3ef35c80e0d76d32939f00c10ee9031f2a0b84766a86b55a8d90f357910fb400cd2d2cec4d0f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
            fromAmount: '2001170684', // 0x774770fc — ~2001 USDT
            toAmountMin: '1922754907', // 0x729ae95b — ~1923 USDC (≈4% slippage)
            expectedCallDataOffset: 612,
            expectedMinReceivedOffset: 164,
        },
    ]

    describe('real production calldata', () => {
        test.each(REAL_LIFI_SAMPLES)(
            '$label - byte-search finds expected offsets',
            ({ callData, fromAmount, toAmountMin, expectedCallDataOffset, expectedMinReceivedOffset }) => {
                expect(LifiTrade.findValueOffset(callData, fromAmount)).toBe(expectedCallDataOffset)
                expect(LifiTrade.findValueOffset(callData, toAmountMin)).toBe(expectedMinReceivedOffset)
            }
        )

        test.each(REAL_LIFI_SAMPLES)(
            '$label - offsets are non-zero and distinct',
            ({ callData, fromAmount, toAmountMin }) => {
                const fromOffset = LifiTrade.findValueOffset(callData, fromAmount)
                const minOffset = LifiTrade.findValueOffset(callData, toAmountMin)
                expect(fromOffset).toBeGreaterThan(0)
                expect(minOffset).toBeGreaterThan(0)
                expect(fromOffset).not.toEqual(minOffset)
            }
        )

        test.each(REAL_LIFI_SAMPLES)(
            '$label - getAmountFromCallData reads back the original amounts',
            ({ callData, fromAmount, toAmountMin, expectedCallDataOffset, expectedMinReceivedOffset }) => {
                expect(SymbiosisTrade.getAmountFromCallData(callData, expectedCallDataOffset)).toEqual(
                    BigNumber.from(fromAmount)
                )
                expect(SymbiosisTrade.getAmountFromCallData(callData, expectedMinReceivedOffset)).toEqual(
                    BigNumber.from(toAmountMin)
                )
            }
        )

        test.each(REAL_LIFI_SAMPLES)(
            '$label - patchCallData round-trips both amounts',
            ({ callData, fromAmount, expectedCallDataOffset, expectedMinReceivedOffset }) => {
                const newFromAmount = BigNumber.from(fromAmount).mul(7).div(10)
                const newToAmountMin = newFromAmount.mul(99).div(100)
                let patched = SymbiosisTrade.patchCallData(callData, expectedCallDataOffset, newFromAmount)
                patched = SymbiosisTrade.patchCallData(patched, expectedMinReceivedOffset, newToAmountMin)
                expect(SymbiosisTrade.getAmountFromCallData(patched, expectedCallDataOffset)).toEqual(newFromAmount)
                expect(SymbiosisTrade.getAmountFromCallData(patched, expectedMinReceivedOffset)).toEqual(newToAmountMin)
            }
        )
    })
})

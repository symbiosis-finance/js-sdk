import { BigNumber, ethers } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'
import { KyberSwapTrade } from '../../../src/crosschain/trade/kyberSwapTrade'

describe('KyberSwapTrade', () => {
    describe('isAvailable', () => {
        test('supported chains', () => {
            expect(KyberSwapTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(KyberSwapTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(KyberSwapTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(KyberSwapTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
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
        const trade = new KyberSwapTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: {} as any,
        })

        test('returns kyber-swap', () => {
            expect(trade.tradeType).toEqual('kyber-swap')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    describe('offset calculation for swap(SwapExecutionParams)', () => {
        const AMOUNT = BigNumber.from('123456789')
        const MIN_RETURN = BigNumber.from('100000000')

        const swapAbi = [
            'function swap((address callTarget, address approveTarget, bytes targetData, (address srcToken, address dstToken, address[] srcReceivers, uint256[] srcAmounts, address[] feeReceivers, uint256[] feeAmounts, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes clientData) execution)',
        ]
        const iface = new ethers.utils.Interface(swapAbi)

        function encodeSwap(srcReceivers: string[] = [], srcAmounts: BigNumber[] = []) {
            return iface.encodeFunctionData('swap', [
                {
                    callTarget: '0x1111111111111111111111111111111111111111',
                    approveTarget: '0x2222222222222222222222222222222222222222',
                    targetData: '0xaabb',
                    desc: {
                        srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                        dstToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                        srcReceivers,
                        srcAmounts,
                        feeReceivers: [],
                        feeAmounts: [],
                        dstReceiver: '0x4444444444444444444444444444444444444444',
                        amount: AMOUNT,
                        minReturnAmount: MIN_RETURN,
                        flags: 0,
                        permit: '0x',
                    },
                    clientData: '0x',
                },
            ])
        }

        test('with empty arrays', () => {
            const callData = encodeSwap()
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })

        test('with non-empty srcReceivers/srcAmounts', () => {
            const callData = encodeSwap(
                ['0x5555555555555555555555555555555555555555', '0x6666666666666666666666666666666666666666'],
                [BigNumber.from('50000'), BigNumber.from('60000')]
            )
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })

        test('patching preserves correct values', () => {
            const callData = encodeSwap()
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            const newAmount = BigNumber.from('999999999')
            const patched = SymbiosisTrade.patchCallData(callData, amountOffset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, amountOffset)).toEqual(newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, minReceivedOffset)).toEqual(MIN_RETURN)
        })
    })

    describe('offset calculation for swapSimpleMode', () => {
        const AMOUNT = BigNumber.from('555555555')
        const MIN_RETURN = BigNumber.from('444444444')

        const swapSimpleAbi = [
            'function swapSimpleMode(address caller, (address srcToken, address dstToken, address[] srcReceivers, uint256[] srcAmounts, address[] feeReceivers, uint256[] feeAmounts, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes executorData, bytes clientData)',
        ]
        const iface = new ethers.utils.Interface(swapSimpleAbi)

        function encodeSwapSimple(srcReceivers: string[] = [], srcAmounts: BigNumber[] = []) {
            return iface.encodeFunctionData('swapSimpleMode', [
                '0x7777777777777777777777777777777777777777',
                {
                    srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    dstToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                    srcReceivers,
                    srcAmounts,
                    feeReceivers: [],
                    feeAmounts: [],
                    dstReceiver: '0x4444444444444444444444444444444444444444',
                    amount: AMOUNT,
                    minReturnAmount: MIN_RETURN,
                    flags: 0,
                    permit: '0x',
                },
                '0xaabbcc',
                '0xddee',
            ])
        }

        test('with empty arrays', () => {
            const callData = encodeSwapSimple()
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })

        test('with non-empty srcReceivers/srcAmounts', () => {
            const callData = encodeSwapSimple(
                ['0x8888888888888888888888888888888888888888'],
                [BigNumber.from('99999')]
            )
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })
    })

    describe('offset calculation for swapGeneric', () => {
        const AMOUNT = BigNumber.from('777777777')
        const MIN_RETURN = BigNumber.from('666666666')

        const swapGenericAbi = [
            'function swapGeneric((address callTarget, address approveTarget, bytes targetData, (address srcToken, address dstToken, address[] srcReceivers, uint256[] srcAmounts, address[] feeReceivers, uint256[] feeAmounts, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes clientData) execution)',
        ]
        const iface = new ethers.utils.Interface(swapGenericAbi)

        test('offsets match', () => {
            const callData = iface.encodeFunctionData('swapGeneric', [
                {
                    callTarget: '0x1111111111111111111111111111111111111111',
                    approveTarget: '0x2222222222222222222222222222222222222222',
                    targetData: '0xaabb',
                    desc: {
                        srcToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                        dstToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
                        srcReceivers: [],
                        srcAmounts: [],
                        feeReceivers: [],
                        feeAmounts: [],
                        dstReceiver: '0x4444444444444444444444444444444444444444',
                        amount: AMOUNT,
                        minReturnAmount: MIN_RETURN,
                        flags: 0,
                        permit: '0x',
                    },
                    clientData: '0x',
                },
            ])
            const { amountOffset, minReceivedOffset } = getOffsetsViaReflection(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })
    })
})

/**
 * Uses the same offset logic as KyberSwapTrade.getOffsets (which is private),
 * reimplemented here for testing.
 */
function getOffsetsViaReflection(callData: string): { amountOffset: number; minReceivedOffset: number } {
    const sigHash = callData.slice(2, 10)

    const SWAP = 'e21fd0e9'
    const SWAP_GENERIC = '59e50fed'
    const SWAP_SIMPLE = '8af033fb'

    if (sigHash === SWAP || sigHash === SWAP_GENERIC) {
        const tupleStart = 4 + 32
        const descOffsetSlot = tupleStart + 3 * 32
        const descOffset = parseInt(callData.slice(2 + descOffsetSlot * 2, 2 + (descOffsetSlot + 32) * 2), 16)
        const descStart = tupleStart + descOffset
        return {
            amountOffset: descStart + 8 * 32,
            minReceivedOffset: descStart + 9 * 32,
        }
    }

    if (sigHash === SWAP_SIMPLE) {
        const paramsStart = 4
        const descOffsetSlot = paramsStart + 32
        const descOffset = parseInt(callData.slice(2 + descOffsetSlot * 2, 2 + (descOffsetSlot + 32) * 2), 16)
        const descStart = paramsStart + descOffset
        return {
            amountOffset: descStart + 8 * 32,
            minReceivedOffset: descStart + 9 * 32,
        }
    }

    throw new Error(`Unknown selector: ${sigHash}`)
}

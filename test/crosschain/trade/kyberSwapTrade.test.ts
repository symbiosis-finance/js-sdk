import { BigNumber, ethers } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { KyberSwapTrade } from '../../../src/crosschain/trade/kyberSwapTrade'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'

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
        const SRC_AMOUNT = BigNumber.from('123456789')
        const MIN_RETURN = BigNumber.from('100000000')

        const swapAbi = [
            'function swap((address callTarget, address approveTarget, bytes targetData, (address srcToken, address dstToken, address[] srcReceivers, uint256[] srcAmounts, address[] feeReceivers, uint256[] feeAmounts, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes clientData) execution)',
        ]
        const iface = new ethers.utils.Interface(swapAbi)

        function encodeSwap(
            srcReceivers: string[] = ['0x5555555555555555555555555555555555555555'],
            srcAmounts: BigNumber[] = [SRC_AMOUNT]
        ) {
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

        test('amountOffset points to srcAmounts[0]', () => {
            const callData = encodeSwap()
            const { amountOffset, minReceivedOffset } = KyberSwapTrade.getOffsets(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(SRC_AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })

        test('amountOffset reads srcAmounts[0], not desc.amount', () => {
            const differentSrcAmount = BigNumber.from('99999')
            const callData = encodeSwap(['0x5555555555555555555555555555555555555555'], [differentSrcAmount])
            const { amountOffset } = KyberSwapTrade.getOffsets(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(differentSrcAmount)
        })

        test('patching srcAmounts[0] preserves other values', () => {
            const callData = encodeSwap()
            const { amountOffset, minReceivedOffset } = KyberSwapTrade.getOffsets(callData)

            const newAmount = BigNumber.from('999999999')
            const patched = SymbiosisTrade.patchCallData(callData, amountOffset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, amountOffset)).toEqual(newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, minReceivedOffset)).toEqual(MIN_RETURN)
        })
    })

    describe('offset calculation for swapSimpleMode', () => {
        const AMOUNT = BigNumber.from('555555555')
        const SRC_AMOUNT = BigNumber.from('555555555')
        const MIN_RETURN = BigNumber.from('444444444')

        const swapSimpleAbi = [
            'function swapSimpleMode(address caller, (address srcToken, address dstToken, address[] srcReceivers, uint256[] srcAmounts, address[] feeReceivers, uint256[] feeAmounts, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags, bytes permit) desc, bytes executorData, bytes clientData)',
        ]
        const iface = new ethers.utils.Interface(swapSimpleAbi)

        function encodeSwapSimple(
            srcReceivers: string[] = ['0x8888888888888888888888888888888888888888'],
            srcAmounts: BigNumber[] = [SRC_AMOUNT]
        ) {
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

        test('amountOffset points to srcAmounts[0]', () => {
            const callData = encodeSwapSimple()
            const { amountOffset, minReceivedOffset } = KyberSwapTrade.getOffsets(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(SRC_AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })

        test('amountOffset reads srcAmounts[0], not desc.amount', () => {
            const differentSrcAmount = BigNumber.from('99999')
            const callData = encodeSwapSimple(['0x8888888888888888888888888888888888888888'], [differentSrcAmount])
            const { amountOffset } = KyberSwapTrade.getOffsets(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(differentSrcAmount)
        })
    })

    describe('offset calculation for swapGeneric', () => {
        const AMOUNT = BigNumber.from('777777777')
        const SRC_AMOUNT = BigNumber.from('777777777')
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
                        srcReceivers: ['0x5555555555555555555555555555555555555555'],
                        srcAmounts: [SRC_AMOUNT],
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
            const { amountOffset, minReceivedOffset } = KyberSwapTrade.getOffsets(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(SRC_AMOUNT)
            expect(SymbiosisTrade.getAmountFromCallData(callData, minReceivedOffset)).toEqual(MIN_RETURN)
        })
    })
})

import { BigNumber, ethers } from 'ethers'
import { describe, expect, test } from 'vitest'

import { ChainId, Token, TokenAmount } from '../../../src'
import { ZeroXTrade } from '../../../src/crosschain/trade/zeroXTrade'
import { SymbiosisTrade } from '../../../src/crosschain/trade/symbiosisTrade'

describe('ZeroXTrade', () => {
    describe('isAvailable', () => {
        test('supported chains', () => {
            expect(ZeroXTrade.isAvailable(ChainId.ETH_MAINNET)).toBe(true)
            expect(ZeroXTrade.isAvailable(ChainId.BSC_MAINNET)).toBe(true)
            expect(ZeroXTrade.isAvailable(ChainId.ARBITRUM_MAINNET)).toBe(true)
            expect(ZeroXTrade.isAvailable(ChainId.BASE_MAINNET)).toBe(true)
            expect(ZeroXTrade.isAvailable(ChainId.MATIC_MAINNET)).toBe(true)
            expect(ZeroXTrade.isAvailable(ChainId.LINEA_MAINNET)).toBe(true)
        })

        test('unsupported chains', () => {
            expect(ZeroXTrade.isAvailable(ChainId.TRON_MAINNET)).toBe(false)
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
        const trade = new ZeroXTrade({
            tokenAmountIn: new TokenAmount(tokenIn, '100000000'),
            tokenAmountInMin: new TokenAmount(tokenIn, '90000000'),
            tokenOut,
            to: '0x1111111111111111111111111111111111111111',
            from: '0x2222222222222222222222222222222222222222',
            slippage: 100,
            symbiosis: { zeroXConfig: { apiUrl: '', apiKeys: ['test'] } } as any,
        })

        test('returns 0x', () => {
            expect(trade.tradeType).toEqual('0x')
        })

        test('not initialized', () => {
            expect(() => trade.amountOut).toThrowError()
        })
    })

    describe('offset calculation for AllowanceHolder.exec', () => {
        const AMOUNT = BigNumber.from('987654321')

        const execAbi = ['function exec(address operator, address token, uint256 amount, address target, bytes data)']
        const iface = new ethers.utils.Interface(execAbi)

        function encodeExec(amount: BigNumber = AMOUNT) {
            return iface.encodeFunctionData('exec', [
                '0x1111111111111111111111111111111111111111',
                '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                amount,
                '0x3333333333333333333333333333333333333333',
                '0xaabbccdd',
            ])
        }

        test('finds amount at correct offset', () => {
            const callData = encodeExec()
            const amountOffset = ZeroXTrade.getAmountOffset(callData)

            expect(SymbiosisTrade.getAmountFromCallData(callData, amountOffset)).toEqual(AMOUNT)
        })

        test('patching preserves correct value', () => {
            const callData = encodeExec()
            const amountOffset = ZeroXTrade.getAmountOffset(callData)

            const newAmount = BigNumber.from('111111111')
            const patched = SymbiosisTrade.patchCallData(callData, amountOffset, newAmount)
            expect(SymbiosisTrade.getAmountFromCallData(patched, amountOffset)).toEqual(newAmount)
        })

        test('rejects unknown selector', () => {
            const unknownCallData = '0xdeadbeef' + '00'.repeat(160)
            expect(() => ZeroXTrade.getAmountOffset(unknownCallData)).toThrowError('Unknown 0x swap method')
        })

        test('offset is 100', () => {
            const callData = encodeExec()
            expect(ZeroXTrade.getAmountOffset(callData)).toBe(100)
        })
    })

    describe('findValueOffset', () => {
        test('finds a value embedded in calldata', () => {
            const value = BigNumber.from('123456789012345678')
            const callData =
                '0x' + 'aabbccdd' + '0'.repeat(64) + value.toHexString().slice(2).padStart(64, '0') + '0'.repeat(64)
            const offset = ZeroXTrade.findValueOffset(callData, value.toString())

            expect(offset).toBeGreaterThan(0)
            expect(SymbiosisTrade.getAmountFromCallData(callData, offset)).toEqual(value)
        })

        test('returns 0 for zero value', () => {
            expect(ZeroXTrade.findValueOffset('0x' + '00'.repeat(64), '0')).toBe(0)
        })

        test('returns 0 when value not found', () => {
            const callData = '0x' + 'ff'.repeat(64)
            expect(ZeroXTrade.findValueOffset(callData, '42')).toBe(0)
        })

        test('found offset is patchable', () => {
            const minReceived = BigNumber.from('999888777666')
            const padding = '0'.repeat(128)
            const callData = '0xdeadbeef' + padding + minReceived.toHexString().slice(2).padStart(64, '0') + padding
            const offset = ZeroXTrade.findValueOffset(callData, minReceived.toString())

            const newMin = BigNumber.from('500000000000')
            const patched = SymbiosisTrade.patchCallData(callData, offset, newMin)
            expect(SymbiosisTrade.getAmountFromCallData(patched, offset)).toEqual(newMin)
        })
    })
})

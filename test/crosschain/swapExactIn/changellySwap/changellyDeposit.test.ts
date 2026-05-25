import { describe, expect, test } from 'vitest'
import { ChainId } from '../../../../src/constants'
import { TradeProvider } from '../../../../src/crosschain/trade'
import { isChangellyDepositSupported } from '../../../../src/crosschain/swapExactIn/changellySwap/changellyDeposit'

describe('isChangellyDepositSupported', () => {
    test('returns false when disabledProviders includes CHANGELLY', () => {
        const params = {
            tokenAmountIn: { token: { chainId: ChainId.XMR_MAINNET } },
            tokenOut: { chainId: ChainId.ETH_MAINNET },
            disabledProviders: [TradeProvider.CHANGELLY],
        } as any
        expect(isChangellyDepositSupported(params)).toBe(false)
    })

    test('returns true for a Changelly-native source (XMR)', () => {
        const params = {
            tokenAmountIn: { token: { chainId: ChainId.XMR_MAINNET } },
            tokenOut: { chainId: ChainId.ETH_MAINNET },
        } as any
        expect(isChangellyDepositSupported(params)).toBe(true)
    })

    test('returns false for an EVM source (Changelly-trade chain — handled by changellyNativeSwap, not deposit)', () => {
        const params = {
            tokenAmountIn: { token: { chainId: ChainId.ETH_MAINNET } },
            tokenOut: { chainId: ChainId.XMR_MAINNET },
        } as any
        expect(isChangellyDepositSupported(params)).toBe(false)
    })
})

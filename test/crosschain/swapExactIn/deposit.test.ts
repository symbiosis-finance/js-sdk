import { describe, expect, test } from 'vitest'
import { AddressZero } from '@ethersproject/constants'
import { ChainId } from '../../../src/constants'
import { GAS_TOKEN, Percent, TokenAmount } from '../../../src/entities'
import { BIPS_BASE } from '../../../src/crosschain/constants'
import { buildDepositResult } from '../../../src/crosschain/swapExactIn/deposit'
import { TradeProvider } from '../../../src/crosschain/trade'

const XMR = GAS_TOKEN[ChainId.XMR_MAINNET]
const ETH = GAS_TOKEN[ChainId.ETH_MAINNET]

const MINIMAL_ARGS = {
    transactionRequest: {
        provider: 'changelly' as const,
        changellyTxId: 'abc123',
        depositAddress: '4ABC...',
        amountExpectedFrom: '1.5',
        amountExpectedTo: '0.04',
        networkFee: '0',
        validUntil: 9_999_999_999_000,
        currencyFrom: 'xmr',
        currencyTo: 'eth',
    },
    tokenAmountOut: new TokenAmount(ETH, '99000000'),
    routes: [{ provider: TradeProvider.CHANGELLY, tokens: [XMR, ETH] }],
    fees: [],
}

describe('buildDepositResult', () => {
    test('default tokenAmountOutMin falls back to tokenAmountOut when omitted', () => {
        const result = buildDepositResult(MINIMAL_ARGS)
        expect(result.tokenAmountOutMin).toBe(result.tokenAmountOut)
        expect(result.tokenAmountOutMin.raw.toString()).toBe('99000000')
    })

    test('tokenAmountOutMin is preserved when passed explicitly', () => {
        const min = new TokenAmount(ETH, '95000000')
        const result = buildDepositResult({ ...MINIMAL_ARGS, tokenAmountOutMin: min })
        expect(result.tokenAmountOutMin.raw.toString()).toBe('95000000')
    })

    test('default priceImpact is 0/BIPS_BASE', () => {
        const result = buildDepositResult(MINIMAL_ARGS)
        expect(result.priceImpact).toEqual(new Percent('0', BIPS_BASE))
    })

    test('default approveTo is AddressZero', () => {
        const result = buildDepositResult(MINIMAL_ARGS)
        expect(result.approveTo).toBe(AddressZero)
    })

    test("default labels is ['partner-swap']", () => {
        const result = buildDepositResult(MINIMAL_ARGS)
        expect(result.labels).toEqual(['partner-swap'])
    })

    test("operationType is always 'deposit'", () => {
        const result = buildDepositResult(MINIMAL_ARGS)
        expect(result.operationType).toBe('deposit')
    })
})
